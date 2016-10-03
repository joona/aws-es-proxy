# Simple Local AWS ElasticSearch Service proxy

Easily utilise `curl`, Sense and other tools of your liking to get answers from your AWS hosted ElasticSearch Service while developing or debugging.

`aws-es-proxy` is a dead simple local proxy, that knows how to sign your requests and talk to a hosted AWS ElasticSearch Service. 

## Prequisities

* node >= v4.0.0 (ES6)
* aws-cli configured for access

## Usage

```
$ aws-es-proxy --port 9200 --profile default --region eu-west-1 <elastichsearch_url>
```

Fires up simple node HTTP proxy on port 9200 and signs your requests using aws-sdk using your `default` local AWS profile.

```
$ curl http://localhost:9200
{
  "status" : 200,
  "name" : "Superia",
  "cluster_name" : "123456789:search",
  "version" : {
    "number" : "1.5.2",
    "build_hash" : "20085dbc168df96c59c4be65f2999990762dfc6f",
    "build_timestamp" : "2016-04-20T15:51:59Z",
    "build_snapshot" : false,
    "lucene_version" : "4.10.4"
  },
  "tagline" : "You Know, for Search"
}
```
