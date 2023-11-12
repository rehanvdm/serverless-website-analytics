import { SQSEvent, SQSBatchResponse, Context, S3Event } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/ts-process/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { S3PageViews } from '@backend/lib/dal/s3/page_views';
import { AthenaPageViews } from '@backend/lib/dal/athena/page_views';
import { S3Events } from '@backend/lib/dal/s3/events';
import { AthenaEvents } from '@backend/lib/dal/athena/events';
import { TimestreamWriteClient, WriteRecordsCommand, _Record, Dimension } from '@aws-sdk/client-timestream-write';
import { Page } from '@backend/lib/models/page';
import { S3AnalyticData } from '@backend/lib/dal/s3/analytic_data';
import { groupBy, orderBy, chunk } from 'lodash';

/* Lazy loaded variables */
let initialized = false;
const logger = new LambdaLog();

// Promise<SQSBatchResponse>
export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log('EVENT', event);

  const shouldInitialize = !initialized || process.env.TESTING_LOCAL_RE_INIT === 'true';
  if (shouldInitialize) {
    LambdaEnvironment.init();
    logger.init(LambdaEnvironment.ENVIRONMENT);
    initialized = true;
  }

  LambdaEnvironment.TRACE_ID = context.awsRequestId;
  logger.start(LambdaEnvironment.LOG_LEVEL, LambdaEnvironment.TRACE_ID);
  // logger.info('Init', event);

  const audit: AuditLog = {
    app_version: LambdaEnvironment.VERSION,
    audit_log_id: uuidv4(),
    trace_id: LambdaEnvironment.TRACE_ID,
    created_at: DateUtils.stringifyIso(DateUtils.now()),
    environment: LambdaEnvironment.ENVIRONMENT,
    meta: '',
    origin: 'swa/ts-process',
    run_time: 0,
    success: true,
    type: 'worker',
  };

  try {
    if (event.Records.length !== 1)
      throw new Error('Processing supports batching 1 SQS record at a time, received :' + event.Records.length);

    const s3Event = JSON.parse(event.Records[0].body) as S3Event;
    if (s3Event.Records.length !== 1)
      throw new Error('Processing supports batching 1 S3 record per SQS message, received :' + s3Event.Records.length);

    const s3DataAnalytics = new S3AnalyticData(LambdaEnvironment.TIMESTREAM_ANALYTICS_BUCKET);
    const objectKey = s3Event.Records[0].s3.object.key.replaceAll('%3D', '='); // For some reason = is encoded as %3D in the event.
    const s3File = await s3DataAnalytics.getObjectString(objectKey);
    if (!s3File) throw new Error('Could not find file in S3');

    const s3Records = s3File
      .split('\n')
      .filter((line) => !!line)
      .map((line) => JSON.parse(line))
      .slice(0, -1);

    const pageViews = s3Records.filter((record) => record.type === 'page').map((record) => record.data) as Page[];
    const pageViewsLatest = Object.values(groupBy(pageViews, (pageView: Page) => pageView.page_id)).map(
      (pageViewsById: Page[]) => orderBy(pageViewsById, (pageView: Page) => pageView.time_on_page, 'desc')[0]
    );

    const tsRecords: _Record[] = [];
    for (const pageView of pageViewsLatest) {
      const pageOpenedAt = DateUtils.parseIso(pageView.page_opened_at);
      const pageViewItems = Object.entries(pageView);

      const dimensions: Dimension[] = [];
      for (const [key, value] of pageViewItems) {
        if (['time_on_page', 'page_opened_at'].includes(key)) continue;

        dimensions.push({
          Name: key,
          Value: value.toString(),
          DimensionValueType: 'VARCHAR',
        });
      }

      tsRecords.push({
        Dimensions: dimensions,
        MeasureName: 'time_on_page',
        MeasureValue: pageView.time_on_page.toString(),
        MeasureValueType: 'DOUBLE',
        Time: pageOpenedAt.getTime().toString(),
        Version: pageView.time_on_page + 1, // offset by one because the time on page can be 0
      });
    }

    const timestreamClient = new TimestreamWriteClient({ region: process.env.AWS_REGION });
    const tsRecordsChunked = chunk(tsRecords, 100);
    for (const tsRecordsChunk of tsRecordsChunked) {
      try {
        const response = await timestreamClient.send(
          new WriteRecordsCommand({
            DatabaseName: LambdaEnvironment.TIMESTREAM_DATABASE_NAME,
            TableName: LambdaEnvironment.TIMESTREAM_TABLE_NAME,
            Records: tsRecordsChunk,
          })
        );
        logger.info(JSON.stringify(response));
      } catch (error) {
        logger.error('Error writing to TS');
        logger.error(JSON.stringify(error));
      }
    }

    audit.success = true;
  } catch (err) {
    /* Should ideally never happen, the tRPC Lambda Handler will catch any `throw new Error(...)` and still
     * return a response that has status code 500. This is just to cover all the basis. */
    if (err instanceof Error) {
      logger.error(err);
      audit.success = false;
      audit.status_description = err.message;
      audit.meta = JSON.stringify(err.message);
    } else {
      throw new Error('Error is unknown', { cause: err });
    }
  } finally {
    audit.run_time = LambdaEnvironment.TIMEOUT * 1000 - context.getRemainingTimeInMillis();
    logger.audit(audit);
  }
};
