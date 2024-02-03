var USERNAME = '{USERNAME}';
var PASSWORD = '{PASSWORD}';

var response401 = {
  statusCode: 401,
  statusDescription: 'Unauthorized',
  headers: {
    'www-authenticate': {value:'Basic'},
  },
};

function validateBasicAuth(authHeader)
{
  var match = authHeader.match(/^Basic (.+)$/);
  if (!match)
    return false;

  //https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-features.html
  var credentials = String.bytesFrom(match[1], 'base64').split(':', 2);

  return credentials[0] === USERNAME && credentials[1] === PASSWORD;
}

export function handler(event)
{
  var request = event.request;
  var headers = request.headers;
  var auth = (headers.authorization && headers.authorization.value) || '';

  if (!validateBasicAuth(auth))
    return response401;

  return request;
}
