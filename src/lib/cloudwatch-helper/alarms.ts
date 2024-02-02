import * as assert from 'assert';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchactions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { CwFirehose, CwLambda } from './index';
import { CwMetrics } from './metrics';

function metricToAlarmId(scope: Construct, metric: cloudwatch.Metric) {
  return [scope.node.id, metric.metricName, 'Alarm'].join('-');
}
function metricToAlarmName(scope: Construct, metric: cloudwatch.Metric) {
  return [scope.node.id, metric.namespace, metric.metricName].join('/');
}

export namespace CwAlarms {
  export class Lambda {
    static softError(
      scope: Construct,
      cwLambda: CwLambda,
      cwAlarmAction: cloudwatch.IAlarmAction,
      cwOkAction?: cloudwatch.IAlarmAction
    ) {
      assert.ok(cwLambda.alarm.softErrorFilter);

      const METRIC_NAMESPACE = 'LogMetrics/Lambda';
      const metricProps: cloudwatch.MetricProps = {
        namespace: METRIC_NAMESPACE,
        metricName: 'SoftError',
        dimensionsMap: { FunctionName: cwLambda.func.functionName },
        label: cwLambda.func.node.id,
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      };
      const metric = new cloudwatch.Metric(metricProps);
      const id = [cwLambda.func.node.id, metric.metricName, 'Alarm'].join('-');

      new logs.MetricFilter(scope, id + 'Filter', {
        metricName: metric.metricName,
        metricNamespace: metric.namespace,
        logGroup: cwLambda.func.logGroup,
        filterPattern: cwLambda.alarm.softErrorFilter,
        metricValue: '1',
      });
      const alarm = new cloudwatch.Alarm(scope, id + 'Alarm', {
        metric,
        alarmDescription:
          'Lambda Soft Error - An error occurred within the function but the invocation still succeeded.',
        actionsEnabled: true,
        alarmName: metricToAlarmName(cwLambda.func, metric),
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(cwAlarmAction);
      if (cwOkAction) alarm.addOkAction(cwAlarmAction);

      return { alarm, metricProps };
    }

    static hardError(
      scope: Construct,
      cwLambda: CwLambda,
      cwAlarmAction: cloudwatchactions.SnsAction,
      cwOkAction?: cloudwatch.IAlarmAction
    ) {
      const metric = cwLambda.func.metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      });

      const alarm = new cloudwatch.Alarm(scope, metricToAlarmId(cwLambda.func, metric), {
        metric: cwLambda.func.metricErrors(),
        alarmDescription: 'Lambda Hard Error - An error occurred and the function invocation failed.',
        actionsEnabled: true,
        alarmName: metricToAlarmName(cwLambda.func, metric),
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(cwAlarmAction);
      if (cwOkAction) alarm.addOkAction(cwAlarmAction);

      return alarm;
    }
  }

  export class Firehose {
    static deliveryToS3Success(
      scope: Construct,
      cwFirehose: CwFirehose,
      cwAlarmAction: cloudwatch.IAlarmAction,
      cwOkAction?: cloudwatch.IAlarmAction
    ) {
      const metric = CwMetrics.Firehose.deliveryToS3Success(cwFirehose, {
        period: cdk.Duration.minutes(1),
      });
      const alarm = new cloudwatch.Alarm(scope, metricToAlarmId(cwFirehose.firehose, metric), {
        metric,
        alarmDescription: 'Firehose Delivery to S3 Error - Not all records delivered to S3, 100% is value 1.0.',
        actionsEnabled: true,
        alarmName: metricToAlarmName(cwFirehose.firehose, metric),
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(cwAlarmAction);
      if (cwOkAction) alarm.addOkAction(cwAlarmAction);

      return alarm;
    }

    static throttleRecords(
      scope: Construct,
      cwFirehose: CwFirehose,
      cwAlarmAction: cloudwatch.IAlarmAction,
      cwOkAction?: cloudwatch.IAlarmAction
    ) {
      const metric = CwMetrics.Firehose.throttleRecords(cwFirehose, {
        period: cdk.Duration.minutes(1),
      });
      const alarm = new cloudwatch.Alarm(scope, metricToAlarmId(cwFirehose.firehose, metric), {
        metric,
        alarmDescription: 'Firehose Throttle Error - Not all records have been accepted.',
        actionsEnabled: true,
        alarmName: metricToAlarmName(cwFirehose.firehose, metric),
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(cwAlarmAction);
      if (cwOkAction) alarm.addOkAction(cwAlarmAction);

      return alarm;
    }
  }
}
