/**
 * Profile Stats MicroService.
 */
'use strict';

const framework = '@microservice-framework';
const Cluster = require(framework + '/microservice-cluster');
const Microservice = require(framework + '/microservice');
const MicroserviceRouterRegister = require(framework + '/microservice-router-register').register;
const debugF = require('debug');
const crypto = require('crypto');

var debug = {
  log: debugF('proxy:log'),
  debug: debugF('proxy:debug')
};

require('dotenv').config();

var mservice = new Microservice({
  mongoUrl: process.env.MONGO_URL + process.env.MONGO_PREFIX + process.env.MONGO_OPTIONS,
  mongoTable: process.env.MONGO_TABLE,
  secureKey: process.env.SECURE_KEY,
  schema: process.env.SCHEMA,
  id: {
    title: 'username',
    field: 'login',
    type: 'string',
    description: 'User login.'
  }
});

var mControlCluster = new Cluster({
  pid: process.env.PIDFILE,
  port: process.env.PORT,
  hostname: process.env.HOSTNAME,
  count: process.env.WORKERS,
  callbacks: {
    init: microserviceUsersINIT,
    validate: mservice.validate,
    POST: microserviceUsersPOST,
    GET: microserviceUsersGET,
    PUT: microserviceUsersPUT,
    DELETE: mservice.delete,
    SEARCH: microserviceUsersSEARCH,
    OPTIONS: mservice.options
  }
});

/**
 * Init Handler.
 */
function microserviceUsersINIT(cluster, worker, address) {
  if (worker.id == 1) {
    var mserviceRegister = new MicroserviceRouterRegister({
      server: {
        url: process.env.ROUTER_URL,
        secureKey: process.env.ROUTER_SECRET,
        period: process.env.ROUTER_PERIOD,
      },
      route: {
        path: [process.env.SELF_PATH],
        url: process.env.SELF_URL,
        secureKey: process.env.SECURE_KEY,
        provides: {
          ':username': {
            field: 'login',
            type: 'string'
          }
        }
      },
      cluster: cluster
    });
  }
}

/**
 * Wrapper for Get.
 */
function microserviceUsersGET(jsonData, requestDetails, callback) {
  requestDetails.url = requestDetails.url.toLowerCase();
  mservice.get(jsonData, requestDetails, function(err, handlerResponse) {
    if (err) {
      return callback(err, handlerResponse);
    }

    // Remove password from output.
    delete handlerResponse.answer.hash;
    if(requestDetails.auth_methods && requestDetails.auth_methods['search']) {
      return callback(err, handlerResponse);
    }
    if (requestDetails.credentials) {
      if (requestDetails.credentials.username) {
        if (requestDetails.credentials.username != handlerResponse.answer.login) {
          return callback(new Error('Access violation.'));
        }
      }
    }
    return callback(err, handlerResponse);
  });
}

/**
 * POST handler.
 */
function microserviceUsersPOST(jsonData, requestDetails, callback) {
  jsonData.login = jsonData.login.toLowerCase();
  var searchUser = {
    login: jsonData.login
  }
  mservice.search(searchToken, requestDetails, function(err, handlerResponse) {
    if (handlerResponse.code != 404) {
      return callback(new Error('Login already taken violation.'));
    }

    // Replace password with hash.
    generateHash(jsonData.password,function(err, hash){
      if(err) {
        return callback(err);
      }
      jsonData.hash = hash;
      delete jsonData.password;
      mservice.post(jsonData, requestDetails, callback);
    });
  });
}

/**
 * Wrapper for PUT.
 */
function microserviceUsersPUT(jsonData, requestDetails, callback) {
  // TODO use user for diferentiate CRUDS.
  requestDetails.url = requestDetails.url.toLowerCase();
  if (requestDetails.credentials) {
      if (requestDetails.credentials.username) {
        if (requestDetails.credentials.username != requestDetails.url) {
          if(requestDetails.auth_methods && !requestDetails.auth_methods['search']) {
            return callback(new Error('Access violation.'));
          }
        }
      }
    }
  // TODO: Replace password with hash here.
  if(jsonData.password) {
    generateHash(jsonData.password, function(err, hash){
      if(err) {
        return callback(err);
      }
      jsonData.hash = hash;
      delete jsonData.password;
      mservice.put(jsonData, requestDetails, callback);
    });
    return;
  }
  mservice.put(jsonData, requestDetails, callback);
}

/**
 * Wrapper for Search.
 */
function microserviceUsersSEARCH(jsonData, requestDetails, callback) {

  mservice.search(jsonData, requestDetails, function(err, handlerResponse) {
    if (err) {
      return callback(err, handlerResponse);
    }
    if (handlerResponse.code == 404) {
      return callback(err, handlerResponse);
    }
    for(var user of handlerResponse.answer) {
      // Remove password from output.
      delete user.hash;
    }
    return callback(null, handlerResponse);
  });
}

/**
 * Generate Hash object based on pass.
 */
function generateHash(pass, callback) {
  let hash = {};
  hash.salt = crypto.randomBytes(128).toString('base64');
  hash.iterations = 100000;
  hash.keylen = 512;
  hash.digest = 'sha512';
  crypto.pbkdf2(
    pass,
    hash.salt,
    hash.iterations,
    hash.keylen,
    hash.digest,
    function(err, derivedKey) {
      if(err) {
        return callback(err);
      }
      hash.hash = derivedKey.toString('hex');
      callback(err, hash);
    }
  );
}
