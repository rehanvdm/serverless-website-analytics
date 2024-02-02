import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchactions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { backend } from './backend';
import { backendAnalytics } from './backendAnalytics';
import { frontend } from './frontend';
import { Observability } from './index';
import { CwAlarms, CwBucket, CwCloudFront, CwFirehose, CwGraphWidgets, CwLambda } from './lib/cloudwatch-helper';

export function observability(
  scope: Construct,
  name: (name: string) => string,
  account: string,
  region: string,
  observabilityProps: Observability,
  backendAnalyticsProps: ReturnType<typeof backendAnalytics>,
  backendProps: ReturnType<typeof backend>,
  frontendProps: ReturnType<typeof frontend>
) {
  const cwLambdas: CwLambda[] = [...backendProps.observability.cwLambdas];
  const cwBuckets: CwBucket[] = [...backendAnalyticsProps.observability.cwBuckets];
  const cwFirehoses: CwFirehose[] = [...backendAnalyticsProps.observability.cwFirehoses];
  const cwCloudFronts: CwCloudFront[] = [...frontendProps.observability.cwCloudFronts];

  const cwLambdaSoftErrorGraphMetrics: cloudwatch.Metric[] = [];
  if (observabilityProps.alarms) {
    const cwAlarmAction = new cloudwatchactions.SnsAction(observabilityProps.alarms.alarmTopic);

    if (observabilityProps.alarms.alarmTypes.lambda) {
      for (const cwLambda of cwLambdas) {
        if (cwLambda.alarm.hardError) CwAlarms.Lambda.hardError(scope, cwLambda, cwAlarmAction);
        if (cwLambda.alarm?.softErrorFilter) {
          const { metricProps } = CwAlarms.Lambda.softError(scope, cwLambda, cwAlarmAction);
          cwLambdaSoftErrorGraphMetrics.push(
            new cloudwatch.Metric({
              ...metricProps,
              label: cwLambda.func.functionName + ' Soft',
              unit: cloudwatch.Unit.COUNT,
            })
          );
        }
      }
    }

    if (observabilityProps.alarms.alarmTypes.firehose) {
      for (const cwFirehose of cwFirehoses) {
        CwAlarms.Firehose.throttleRecords(scope, cwFirehose, cwAlarmAction);
        CwAlarms.Firehose.deliveryToS3Success(scope, cwFirehose, cwAlarmAction);
      }
    }
  }

  if (observabilityProps.dashboard) {
    const dashboardName = name('dashboard');
    const dashboard = new cloudwatch.Dashboard(scope, dashboardName, {
      dashboardName,
      // start: "-PT24H",
      start: '-P7D',
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Lambda Metrics',
        width: 24,
        background: cloudwatch.TextWidgetBackground.TRANSPARENT,
        height: 1,
      })
    );
    dashboard.addWidgets(
      new cloudwatch.Row(
        new cloudwatch.GraphWidget({
          title: cwLambdaSoftErrorGraphMetrics.length ? 'Hard Errors | Soft Errors' : 'Hard Errors',
          left: cwLambdas.map((cwLambda) =>
            cwLambda.func.metricErrors({ label: cwLambda.func.functionName + ' Hard' })
          ),
          right: cwLambdaSoftErrorGraphMetrics,
        }),
        new cloudwatch.GraphWidget({
          title: 'Invocations',
          left: cwLambdas.map((cwLambda) => cwLambda.func.metricInvocations({ statistic: 'Sum' })),
        }),
        new cloudwatch.GraphWidget({
          title: 'Throttles',
          left: cwLambdas.map((cwLambda) => cwLambda.func.metricThrottles({ statistic: 'Maximum' })),
        }),
        new cloudwatch.GraphWidget({
          title: 'Duration',
          left: cwLambdas.map((cwLambda) => cwLambda.func.metricDuration({ statistic: 'p95' })),
        })
      )
    );

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## S3 & Firehose',
        width: 24,
        background: cloudwatch.TextWidgetBackground.TRANSPARENT,
        height: 1,
      })
    );
    dashboard.addWidgets(
      new cloudwatch.Row(
        CwGraphWidgets.S3.bucketSize(cwBuckets),
        CwGraphWidgets.S3.objectCount(cwBuckets),
        CwGraphWidgets.Firehose.incomingRecords(cwFirehoses),
        CwGraphWidgets.Firehose.deliveryToS3Success(cwFirehoses)
      )
    );

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## CloudFront',
        width: 24,
        background: cloudwatch.TextWidgetBackground.TRANSPARENT,
        height: 1,
      })
    );
    dashboard.addWidgets(
      new cloudwatch.Row(
        CwGraphWidgets.CloudFront.requests(cwCloudFronts),
        CwGraphWidgets.CloudFront.errors4xxRate(cwCloudFronts),
        CwGraphWidgets.CloudFront.errors5xxRate(cwCloudFronts)
      )
    );

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Lambda Log Insights',
        width: 24,
        background: cloudwatch.TextWidgetBackground.TRANSPARENT,
        height: 1,
      })
    );
    dashboard.addWidgets(
      new cloudwatch.Row(CwGraphWidgets.Logs.insightsLambdaErrors(account, name(''), region, cwLambdas))
    );

    const dashboardUrl =
      `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards/` +
      `dashboard/${dashboardName}`;

    new cdk.CfnOutput(scope, name('DashboardUrl'), {
      description: 'Dashboard Url',
      value: dashboardUrl,
    });

    // https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#dashboards/dashboard/rehan-analytics-swa-dashboard
  }
}
