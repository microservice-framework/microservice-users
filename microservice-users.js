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
const updateAcceptedCmds = [ '$inc', '$mul', '$set', '$unset', '$min', '$max',
  '$currentDate', '$push', '$pull', '$pop', '$addToSet', '$pushAll', '$pullAll' ];

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
  if (process.env.PRIVATE_USERS) {
    if (requestDetails.credentials) {
      if (requestDetails.credentials.role != 'admin') {
        if (requestDetails.credentials.username != requestDetails.url) {
          return callback(new Error('Access violation. You have access only to your own user.'));
        }
      }
    }
  }
  mservice.get(jsonData, requestDetails, function(err, handlerResponse) {
    if (err) {
      return callback(err, handlerResponse);
    }
    // Remove hash from output if access by credentials.
    if (requestDetails.credentials) {
      delete handlerResponse.answer.hash;
    }
    return callback(err, handlerResponse);
  });
}

/**
 * POST handler.
 */
function microserviceUsersPOST(jsonData, requestDetails, callback) {
  if (requestDetails.credentials) {
    if (requestDetails.credentials.role != 'admin') {
      return callback(new Error('Access violation. You have no right to create new user.'));
    }
  }
  jsonData.login = jsonData.login.toLowerCase();
  loginValidation(jsonData.login, requestDetails, function(err) {
    if (err) {
      return callback(err);
    }

    // Replace password with hash.
    generateHash(jsonData.password,function(err, hash) {
      if (err) {
        return callback(err);
      }
      jsonData.hash = hash;
      delete jsonData.password;
      mservice.post(jsonData, requestDetails, function(err, handlerResponse) {
        // Remove hash from output if access by credentials.
        if (requestDetails.credentials) {
          delete handlerResponse.answer.hash;
        }
        callback(err, handlerResponse);
      });
    });
  })
}

/**
 * Wrapper for PUT.
 */
function microserviceUsersPUT(jsonData, requestDetails, callback) {
  requestDetails.url = requestDetails.url.toLowerCase();
  if (requestDetails.credentials) {
    if (requestDetails.credentials.role != 'admin') {
      if (requestDetails.credentials.username != requestDetails.url) {
        return callback(new Error('Access violation. You have access only to your own user.'));
      }
    }
  }
  if (jsonData.hash) {
    return callback(new Error('Access violation. You have no right to replace hash field.'));
  }
  for (var cmd in jsonData) {
    if (updateAcceptedCmds.indexOf(cmd) > -1) {
      for (var key in jsonData[cmd]) {
        if (key == 'hash') {
          return callback(new Error('Access violation. You have no right to replace hash field.'));
        }
      }
    }
  }
  let loginChange = false;
  if (jsonData.login) {
    jsonData.login = jsonData.login.toLowerCase();
    loginChange = jsonData.login;
  }
  for (var cmd in jsonData) {
    if (updateAcceptedCmds.indexOf(cmd) > -1) {
      for (var key in jsonData[cmd]) {
        if (key == 'login') {
          jsonData[cmd]['login'] = jsonData[cmd]['login'].toLowerCase();
          loginChange = jsonData[cmd]['login'];
        }
      }
    }
  }
  if (loginChange !== false) {
    loginValidation(loginChange, requestDetails, function(err) {
      if (err) {
        return callback(err);
      }
      updateRecord(jsonData, requestDetails, callback);
    });
    return;
  }
  updateRecord(jsonData, requestDetails, callback);
}

/**
 * Helper function to save record.
 */
function updateRecord(jsonData, requestDetails, callback) {
  // Replace password with hash here.
  let newPassword = false;
  if (jsonData.password) {
    newPassword = jsonData.password;
    delete jsonData.password;
  }
  let isSet = false;
  for (var cmd in jsonData) {
    if (updateAcceptedCmds.indexOf(cmd) > -1) {
      for (var key in jsonData[cmd]) {
        if (key == 'password') {
          newPassword = jsonData[cmd]['password'];
          delete jsonData[cmd]['password'];
          isSet = true;
        }
      }
    }
  }
  if (newPassword !== false) {
    generateHash(newPassword, function(err, hash) {
      if (err) {
        return callback(err);
      }
      if (isSet) {
        if (jsonData['$set']) {
          jsonData['$set']['hash'] = hash;
        } else {
          jsonData['$set'] = {
            hash: hash
          }
        }
      } else {
        jsonData.hash = hash;
      }
      mservice.put(jsonData, requestDetails, function(err, handlerResponse) {
        // Remove hash from output if access by credentials.
        if (requestDetails.credentials) {
          delete handlerResponse.answer.hash;
        }
        callback(err, handlerResponse);
      });
    });
    return;
  }
  mservice.put(jsonData, requestDetails, function(err, handlerResponse) {
    // Remove hash from output if access by credentials.
    if (requestDetails.credentials) {
      delete handlerResponse.answer.hash;
    }
    callback(err, handlerResponse);
  });
}

/**
 * Wrapper for Search.
 */
function microserviceUsersSEARCH(jsonData, requestDetails, callback) {
  if (process.env.PRIVATE_USERS) {
    if (requestDetails.credentials) {
      if (requestDetails.credentials.role != 'admin') {
        return callback(new Error('Access violation.'));
      }
    }
  }
  mservice.search(jsonData, requestDetails, function(err, handlerResponse) {
    if (err) {
      return callback(err, handlerResponse);
    }
    if (handlerResponse.code == 404) {
      return callback(err, handlerResponse);
    }
    // Remove hash from output if access by credentials.
    if (requestDetails.credentials) {
      for (var user of handlerResponse.answer) {
        delete user.hash;
      }
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
  hash.iterations = 1000;
  hash.keylen = 512;
  hash.digest = 'sha512';
  crypto.pbkdf2(
    pass,
    hash.salt,
    hash.iterations,
    hash.keylen,
    hash.digest,
    function(err, derivedKey) {
      if (err) {
        return callback(err);
      }
      hash.hash = derivedKey.toString('hex');
      callback(err, hash);
    }
  );
}

/**
 * Validate login.
 */
function loginValidation(login, requestDetails, callback) {
  if (login.length < process.env.LOGIN_MIN_LENGTH) {
    return callback(new Error('Minimum login length is ' + process.env.LOGIN_MIN_LENGTH));
  }
  if (login.length > process.env.LOGIN_MAX_LENGTH) {
    return callback(new Error('Maximum login length is ' + process.env.LOGIN_MAX_LENGTH));
  }
  var searchUser = {
    login: login
  }
  mservice.search(searchUser, requestDetails, function(err, handlerResponse) {
    if (handlerResponse.code != 404) {
      return callback(new Error('Login already taken.'));
    }
    return callback(null);
  });
}