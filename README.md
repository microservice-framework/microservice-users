# microservice-users

[![Gitter](https://img.shields.io/gitter/room/microservice-framework/chat.svg?style=flat-square)](https://gitter.im/microservice-framework/chat)
[![npm](https://img.shields.io/npm/dt/@microservice-framework/microservice-users.svg?style=flat-square)](https://www.npmjs.com/~microservice-framework)
[![microservice-frame.work](https://img.shields.io/badge/online%20docs-200-green.svg?style=flat-square)](http://microservice-frame.work)


Users store microservice for [microservice-framework](https://www.npmjs.com/~microservice-framework)


## Create token

```js
const MicroserviceClient = require('@microservice-framework/microservice-client');

require('dotenv').config();

var client = new MicroserviceClient({
  URL: process.env.SELF_URL,
  secureKey: process.env.SECURE_KEY
});

client.post({
    login: 'test',
    password: 'test',
    role: 'user',
    suspended: false
  }, function(err, handlerResponse){
    console.log(err);
    console.log(JSON.stringify(handlerResponse , null, 2));
});

```

 - `login` - User login.
 - `password` - User password.
 - `role` - user or admin. Admin has permission to see all user profiles.
 - `suspended` - true or false. See more details on microservice-users-login
