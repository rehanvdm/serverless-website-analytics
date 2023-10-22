import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  ResultSet,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { S3Client } from '@aws-sdk/client-s3';
import { DateUtils } from '@backend/lib/utils/date_utils';
import assert from 'assert';

type ParseOptions = {
  bigIntAsNumber?: boolean;
  falselyAs?: 'null' | 'undefined';
};

export class AthenaBase {
  private readonly athenaClient: AthenaClient;
  private readonly s3Client: S3Client;
  private readonly dbName: string;
  private readonly queryStorageFullS3Path: string;
  private readonly defaultParseOptions?: ParseOptions;

  constructor(
    athenaClient: AthenaClient,
    s3Client: S3Client,
    dbName: string,
    queryStorageFullS3Path: string,
    defaultParseOptions?: ParseOptions
  ) {
    this.athenaClient = athenaClient;
    this.s3Client = s3Client;
    this.dbName = dbName;
    this.queryStorageFullS3Path = queryStorageFullS3Path;
    this.defaultParseOptions = defaultParseOptions || {
      bigIntAsNumber: true,
      falselyAs: 'null',
    };
  }

  protected async query(
    query: string,
    limit?: number,
    queryExecutionId?: string,
    nextToken?: string,
    parseOptions?: ParseOptions
  ) {
    /* Start query if not already started */
    if (!queryExecutionId) {
      const startQueryCommand = new StartQueryExecutionCommand({
        QueryString: query,
        ResultConfiguration: {
          OutputLocation: this.queryStorageFullS3Path,
        },
        QueryExecutionContext: { Database: this.dbName },
      });
      const startQueryResponse = await this.athenaClient.send(startQueryCommand);
      queryExecutionId = startQueryResponse.QueryExecutionId;

      /* Poll until query is finished */
      let queryState = '';
      while (queryState !== 'SUCCEEDED') {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const getQueryExecutionResponse = await this.athenaClient.send(
          new GetQueryExecutionCommand({
            QueryExecutionId: queryExecutionId,
          })
        );
        queryState = getQueryExecutionResponse.QueryExecution?.Status?.State || '';
        if (queryState === 'FAILED') {
          throw new Error(`Query failed: ${getQueryExecutionResponse.QueryExecution?.Status?.StateChangeReason}`);
        }
      }
    }

    /* Paginate results */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let results: Record<string, any> = [];
    const stopAtPageSize = limit || 1000;
    const maxPageSize = 1000;
    do {
      /* Dynamically calculate the page size. The first row is always the columns we need to fetch one more row, so
         this loop will always run one more time with the last page size being 1 */
      const pageSize = Math.min(maxPageSize, stopAtPageSize - results.length);

      const getQueryResultsResponse = await this.athenaClient.send(
        new GetQueryResultsCommand({
          QueryExecutionId: queryExecutionId,
          NextToken: nextToken,
          MaxResults: pageSize,
        })
      );

      results = results.concat(
        this.parseAthenaResult(getQueryResultsResponse.ResultSet, !nextToken, parseOptions || this.defaultParseOptions)
      );
      nextToken = getQueryResultsResponse.NextToken;
    } while (!!nextToken && results.length < stopAtPageSize);

    return {
      data: results,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      queryExecutionId: queryExecutionId!,
      nextToken,
    };
  }

  /**
   * Parse Athena result set into a JSON array of objects that are correctly typed according to the Athena column types
   * @param athenaResultSet
   * @param isFirstRowHeaders
   * @param parseOptions
   * @private
   */
  private parseAthenaResult(athenaResultSet?: ResultSet, isFirstRowHeaders?: boolean, parseOptions?: ParseOptions) {
    if (!athenaResultSet) {
      return [];
    }

    const rowDatas = athenaResultSet.Rows || [];
    const columns = athenaResultSet.ResultSetMetadata?.ColumnInfo || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any>[] = [];
    const startRow = isFirstRowHeaders ? 1 : 0; // Skip first row, it's the column names
    for (let r = startRow; r < rowDatas.length; r++) {
      const row = rowDatas[r].Data;
      assert(row);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultRow: Record<string, any> = {};
      for (let c = 0; c < columns.length; c++) {
        const column = columns[c];
        const cell = row[c].VarCharValue;
        assert(column.Name);
        switch (column.Type) {
          case 'varchar':
            if (cell === undefined || cell === null) {
              resultRow[column.Name] = parseOptions?.falselyAs === 'null' ? null : undefined;
              continue;
            }
            resultRow[column.Name] = String(cell);
            break;
          case 'boolean':
            resultRow[column.Name] = Boolean(cell);
            break;
          case 'bigint':
            if (cell !== '0' && (cell === undefined || cell === null || cell === 'NaN')) {
              resultRow[column.Name] = parseOptions?.falselyAs === 'null' ? null : undefined;
              continue;
            }

            if (parseOptions?.bigIntAsNumber) {
              resultRow[column.Name] = Number(cell);
            } else {
              resultRow[column.Name] = BigInt(cell);
            }
            break;
          case 'integer':
          case 'tinyint':
          case 'smallint':
          case 'int':
          case 'float':
          case 'double':
            if (cell !== '0' && (cell === undefined || cell === null || cell === 'NaN')) {
              resultRow[column.Name] = parseOptions?.falselyAs === 'null' ? null : undefined;
              continue;
            }

            resultRow[column.Name] = Number(cell);
            break;
          case 'timestamp':
            if (cell === undefined || cell === null || cell === '') {
              resultRow[column.Name] = parseOptions?.falselyAs === 'null' ? null : undefined;
              continue;
            }
            resultRow[column.Name] = DateUtils.parseFormat(cell, 'yyyy-MM-dd HH:mm:ss.SSS');
            break;
          default:
            resultRow[column.Name] = cell;
        }
      }
      result.push(resultRow);
    }
    return result;
  }
}
