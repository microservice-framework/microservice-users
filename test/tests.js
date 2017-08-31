const expect  = require("chai").expect;
const MicroserviceClient = require('@microservice-framework/microservice-client');

require('dotenv').config();

describe('USERS CRUD API',function(){
  var client = new MicroserviceClient({
    URL: process.env.SELF_URL,
    secureKey: process.env.SECURE_KEY,
  });
  var RecordID;
  var RecordToken;
  var userMember = {
    login: 'user',
    password: 'user',
    role: 'user'
  }
  it('POST should return 200',function(done){
    client.post(userMember, function(err, handlerResponse){
      RecordID = handlerResponse.id;
      RecordToken = handlerResponse.token;
      console.log(handlerResponse);
      expect(err).to.equal(null);
      done();
    });
  });

  it('SEARCH should return 200',function(done){
    client.search({ "login": userMember.login }, function(err, handlerResponse){
      expect(err).to.equal(null);
      console.log(handlerResponse);
      expect(handlerResponse).to.not.equal(null);
      done();
    });
  });

  it('PUT login should return 200',function(done){
    client.put(RecordID, RecordToken, {login: 'user2'}, function(err, handlerResponse){
      expect(err).to.equal(null);
      console.log(handlerResponse);
      done();
    });
  });

  it('GET should return 200 and login should be user2',function(done){
    client.get(RecordID, RecordToken, function(err, handlerResponse){
      expect(err).to.equal(null);
      expect(handlerResponse.login).to.equal('user2');
      console.log(handlerResponse);
      done();
    });
  });

  it('PUT password should return 200',function(done){
    client.put(RecordID, RecordToken, {password: 'user2'}, function(err, handlerResponse){
      console.log(handlerResponse);
      expect(err).to.equal(null);
      done();
    });
  });


  it('DELETE should return 200',function(done){
    client.delete(RecordID, RecordToken, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });

  it('GET after delete should return nothing',function(done){
    client.get(RecordID, RecordToken, function(err, handlerResponse){
      expect(err.message).to.equal('Not found');
      done();
    });
  });
});
