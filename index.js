const AWS = require('aws-sdk');
const co = require('co');
const url = require('url');
const http = require('http');
const options = require('optimist')
  .argv;

const context = {};
const profile = process.env.AWS_PROFILE || options.profile || 'default';

var creds = {};
AWS.CredentialProviderChain.defaultProviders = [
  () => { return new AWS.EnvironmentCredentials('AWS'); },
  () => { return new AWS.EnvironmentCredentials('AMAZON'); },
  () => { return new AWS.SharedIniFileCredentials({ profile: profile }); },
  () => { return new AWS.EC2MetadataCredentials(); }
];

var execute = function(endpoint, region, path, headers, method, body) {
  return new Promise((resolve, reject) => {
  co(function* () {
    var req = new AWS.HttpRequest(endpoint);

    if(options.quiet !== true) {
      console.log('>>>', method, path);
    }

    req.method = method || 'GET';
    req.path = path;
    req.region = region;
    req.body = body;

    req.headers['presigned-expires'] = false;
    req.headers.Host = endpoint.host;

    // Some credentials may require refresh, fetch credentails to handles this
    var chain = new AWS.CredentialProviderChain();
    yield chain.resolvePromise()
      .then(function (credentials) {
        creds = credentials;
      })
      .catch(function (err) {
        console.log('Error while getting AWS Credentials.')
        console.log(err);
        process.exit(1);
      });

    var signer = new AWS.Signers.V4(req, 'es');
    signer.addAuthorization(creds, new Date());

    // Now we have signed the "headers", we add extra headers passing
    // from the browser.  We must strip any connection control, transport encoding
    // incorrect Origin headers, and make sure we don't change the Host header from
    // the one used for signing
    var keys = Object.keys(headers)
    for (var i = 0, len = keys.length; i < len; i++) {
      if (keys[i] != "host" && 
        keys[i] != "accept-encoding" &&
        keys[i] != "connection" &&
        keys[i] != "origin") {
        req.headers[keys[i]] = headers[keys[i]];
      }
    }

    var client = new AWS.NodeHttpClient();
    client.handleRequest(req, null, (httpResp) => {
      var body = '';
      httpResp.on('data', (chunk) => {
        body += chunk;
      });
      httpResp.on('end', (chunk) => {
        resolve({
          statusCode: httpResp.statusCode,
          headers: httpResp.headers,
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

var readBody = function(request) {
  return new Promise(resolve => {
    var body = [];

    request.on('data', chunk => {
      body.push(chunk);
    });

    request.on('end', _ => {
      resolve(Buffer.concat(body).toString());
    });
  });
};

var requestHandler = function(request, response) {
  var body = [];

  request.on('data', chunk => {
    body.push(chunk);
  });

  request.on('end', _ => {
    var buf = Buffer.concat(body).toString();

    co(function*(){
        return yield execute(context.endpoint, context.region, request.url, request.headers, request.method, buf);
      })
      .then(resp => {
        // We need to pass through the response headers from the origin
        // back to the UA, but strip any connection control and content encoding
        // headers
        var headers = {}
        var keys = Object.keys(resp.headers);
        for (var i = 0, klen = keys.length; i < klen; i++) {
          var k = keys[i]; 
          if (k != undefined && k != "connection" && k != "content-encoding") {
            headers[k] = resp.headers[keys[i]];
          }
        }

        response.writeHead(resp.statusCode, headers);
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

var startServer = function() {
  return new Promise((resolve) => {
    server.listen(context.port, function(){
      console.log('Listening on', context.port);
      resolve();
    });
  });
};


var main = function() {
  co(function*(){
      var maybeUrl = options._[0];
      context.region = options.region || 'eu-west-1';
      context.port = options.port || 9200;

      if(!maybeUrl || (maybeUrl && maybeUrl == 'help') || options.help || options.h) {
        console.log('Usage: aws-es-proxy [options] <url>');
        console.log();
        console.log('Options:');
        console.log("\t--profile \tAWS profile \t(Default: default)");
        console.log("\t--region \tAWS region \t(Default: eu-west-1)");
        console.log("\t--port  \tLocal port \t(Default: 9200)");
        console.log("\t--quiet  \tLog less");
        process.exit(1);
      }

      if(maybeUrl && maybeUrl.indexOf('http') === 0) {
        var uri = url.parse(maybeUrl);
        context.endpoint = new AWS.Endpoint(uri.host);
      }

      var chain = new AWS.CredentialProviderChain();
      yield chain.resolvePromise()
        .then(function (credentials) {
          creds = credentials;
        })
        .catch(function (err) {
          console.log('Error while getting AWS Credentials.')
          console.log(err);
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
