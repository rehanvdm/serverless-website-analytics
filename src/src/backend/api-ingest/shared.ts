import { UAParser } from 'ua-parser-js';
import { Reader, ReaderModel } from '@maxmind/geoip2-node';
import isbot from 'isbot';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import path from 'path';
import { LambdaEnvironment } from '@backend/api-ingest/environment';

const logger = new LambdaLog();

let maxMindReader: ReaderModel | undefined;

export async function getInfoFromIpAndUa(ip: string, ua: string) {
  if (!maxMindReader) {
    maxMindReader = await Reader.open(
      LambdaEnvironment.GEOLITE2_CITY_PATH.startsWith('.')
        ? path.resolve(LambdaEnvironment.GEOLITE2_CITY_PATH)
        : LambdaEnvironment.GEOLITE2_CITY_PATH
    );
  }

  let countryIso;
  let countryName;
  let cityName;
  let deviceType;
  let isBot;

  /* === IP === */
  if (ip) {
    try {
      const response = maxMindReader.city(ip);
      if (response.country) {
        countryIso = response.country.isoCode;
        countryName = response.country.names.en;
        if (response.city) {
          cityName = response.city.names.en;
        }
      }
    } catch (err) {
      logger.warning('Parsing failed for IP', ip);
      logger.warning(err as Error);
    }
  }

  try {
    /* === Device Type === */
    const uaParsed = new UAParser(ua);
    const device = uaParsed.getDevice();
    // If not defined then desktop https://github.com/faisalman/ua-parser-js/issues/182 else will be one of
    // console, mobile, tablet, smarttv, wearable, embedded
    deviceType = device.type || 'desktop';

    /* === Is bot === */
    isBot = isbot(ua);
  } catch (err) {
    logger.warning('Parsing failed for UA', ua);
    logger.warning(err as Error);
  }

  return { countryIso, countryName, cityName, deviceType, isBot };
}

export function getCleanedUpReferrer(site: string, referrer?: string) {
  if (!referrer) {
    return undefined;
  }

  return referrer.includes(site) ? undefined : referrer;
}
