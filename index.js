const AWS = require('aws-sdk');
const co = require('co');
const url = require('url');
const http = require('http');
const options = require('optimist').argv;

const context = {};
process.env.AWS_PROFILE = process.env.AWS_PROFILE || options.profile || 'default';
var creds = {};

var updateCredentials = function () {
  return new Promise(function (resolve, reject) {
    AWS.config.getCredentials(function (err) {
      if(err) {
        console.log('Error while getting Credentials.');
        console.log(err);
        reject(err)
      }
      resolve()
    })
  });
}

var execute = function (endpoint, region, path, method, body) {
  return new Promise((resolve, reject) => {
    co(function* () {

        var req = new AWS.HttpRequest(endpoint);
        console.log('AWS HTTP Request:', method, path);

        req.method = method || 'GET';
        req.path = path;
        req.region = region;

        if(body) {
          if(typeof body === "object") {
            req.body = JSON.stringify(body);
          } else {
            req.body = body;
          }
        }

        // Sense likes send GET request with body, which aws-sdk doesn't really allow. Translate to POST instead.
        if(req.body && req.method == 'GET') {
          req.method = 'POST';
        }

        req.headers['presigned-expires'] = false;
        req.headers.Host = endpoint.host;

        // Some credentials may require refresh, updateCredentials handles this
        yield updateCredentials()
        var signer = new AWS.Signers.V4(req, 'es');
        signer.addAuthorization(AWS.config.credentials, new Date());

        var send = new AWS.NodeHttpClient();
        send.handleRequest(req, null, (httpResp) => {
          var body = '';
          httpResp.on('data', (chunk) => {
            body += chunk;
          });
          httpResp.on('end', (chunk) => {
            resolve({
              statusCode: httpResp.statusCode,
              body: body
            });
          });
        }, (err) => {
          console.log('Error: ' + err);
          reject(err);
        });
      })
      .catch(err => reject(err))
  });
};

var readBody = function (request) {
  return new Promise(resolve => {
    var body = [];

    request.on('data', chunk => {
      body.push(chunk);
    });

    request.on('end', _ => {
      console.log('end:', body.length);
      resolve(Buffer.concat(body).toString());
    });
  });
};

var requestHandler = function (request, response) {
  var body = [];

  request.on('data', chunk => {
    body.push(chunk);
  });

  request.on('end', _ => {
    var buf = Buffer.concat(body).toString();
    console.log('Body:', buf);

    co(function* () {
        return yield execute(context.endpoint, context.region, request.url, request.method, buf);
      })
      .then(resp => {
        response.writeHead(resp.statusCode, { 'Content-Type': 'application/json' });
        response.end(resp.body);
      })
      .catch(err => {
        console.log('Unexpected error:', err.message);
        console.log(err.stack);

        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(err);
      });
  });
};

var server = http.createServer(requestHandler);

var startServer = function () {
  return new Promise((resolve) => {
    server.listen(context.port, function () {
      console.log('Listening on', context.port);
      resolve();
    });
  });
};

var main = function () {
  co(function* () {
      var maybeUrl = options._[0];
      context.region = options.region || 'eu-west-1';
      context.port = options.port || 9200;

      if(!maybeUrl || (maybeUrl && maybeUrl == 'help') || options.help || options.h) {
        console.log('Usage: aws-es-proxy [options] <url>');
        console.log();
        console.log('Options:');
        console.log("\t--profile \tAWS profile \t(Default: default)");
        console.log("\t--region \tAWS region \t(Default: eu-west-1)");
        console.log("\t--port \tLocal port \t(Default: 9200)");
        process.exit(1);
      }

      if(maybeUrl && maybeUrl.indexOf('http') === 0) {
        var uri = url.parse(maybeUrl);
        context.endpoint = new AWS.Endpoint(uri.host);
      }

      yield updateCredentials()
        .catch(err => {
          // if we cannot find credentials, exit
          process.exit(1);
        });

      yield startServer();
    })
    .then(res => {
      // start service
      console.log('Service started!');
    })
    .catch(err => {
      console.error('Error:', err.message);
      console.log(err.stack);
      process.exit(1);
    });
};

if(!module.parent) {
  main();
}

module.exports = main;
