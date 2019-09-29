var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var key = Buffer.from( global.argv.key, 'utf8' ).slice(0,32);
var iv = Buffer.from( global.argv.iv, 'utf8' ).slice(0,16);
var redis = require("redis");
var client = redis.createClient({host: global.argv.redisHost || 'localhost',
                                 port: global.argv.redisPort || 6379,
                                 password: global.argv.redisPassword || '',
                                 db: global.argv.redisDb || 3});


client.on("error", function (err) {
    console.log("Redis Error " + err);
});
/* GET home page. */
router.get('/', function(req, res, next) {
    res.redirect('/create');
});

router.get('/create', function(req, res, next) {
    res.render('share_a_secret', { title: 'OneTimeSecret - Create A Secret' });
});

router.post('/create', function(req, res, next) {
  var hash = crypto.randomBytes(10).toString('hex');
  var privateHash = crypto.randomBytes(10).toString('hex');
  var storeSecret = {secret: encrypt(req.body.secret), requirePassword: false, privateHash: privateHash};
  if (req.body.password) {
      storeSecret['password'] = encrypt(req.body.password);
      storeSecret.requirePassword = true;
  }
  client.set('OTS:SECRET:'+hash, JSON.stringify(storeSecret), 'EX', req.body.ttl);
  client.set('OTS:PRIVATE:'+privateHash, hash, 'EX', req.body.ttl);
  console.log(req.body);
  res.render('secret_saved', { title: 'OneTimeSecret - Saved', url: req.headers.host+"/secret/"+hash, secret: req.body.secret, privateHash: privateHash });
});

router.get('/secret/:secretId', function(req, res, next) {
    client.get('OTS:SECRET:'+req.params.secretId, function (err, replyStr) {
        var reply = JSON.parse(replyStr);
        if (replyStr && reply) {
            var requirePassword = false;
            if (reply['requirePassword']) {
                requirePassword = true;
            }
            res.render('received_secret', { title: 'OneTimeSecret - View Secret', requirePassword: requirePassword });
        } else {
            res.render('no_such_secret', { title: 'OneTimeSecret - Secret Not Available' });
        }
    });
});

router.post('/secret/:secretId', function(req, res, next) {
    client.get('OTS:SECRET:'+req.params.secretId, function (err, replyStr) {
        var reply = JSON.parse(replyStr);
        if (replyStr && reply && reply.secret) {
            if (!reply['requirePassword'] || decrypt(reply['password']) === req.body['password']) {
                client.del('OTS:SECRET:'+req.params.secretId);
                client.del('OTS:PRIVATE:'+reply.privateHash);

                res.render('view_secret', { title: 'OneTimeSecret - View Secret', secret: decrypt(reply.secret) });
            } else {
                res.render('received_secret', { title: 'OneTimeSecret - View Secret', requirePassword: reply['requirePassword'], passwordError: true });
            }
        } else {
            res.render('no_such_secret', { title: 'OneTimeSecret - Secret Not Available' });
        }
    });
});

router.get('/private/:privateId/burn', function(req, res, next) {
    client.get('OTS:PRIVATE:'+req.params.privateId, function (errP, replyP) {
        if (replyP) {
            client.get('OTS:SECRET:'+replyP.toString(), function (err, replyStr) {
                var reply = JSON.parse(replyStr);
                if (replyStr && reply) {
                    var requirePassword = false;
                    if (reply['requirePassword']) {
                        requirePassword = true;
                    }
                    res.render('confirm_burn', {
                        title: 'OneTimeSecret - View Secret',
                        requirePassword: requirePassword
                    });
                } else {
                    res.render('no_such_secret', { title: 'OneTimeSecret - Secret Not Available' });
                }
            });
        } else {
            res.render('no_such_secret', { title: 'OneTimeSecret - Secret Not Available' });
        }
    });
});

router.post('/private/:privateId/burn', function(req, res, next) {
    client.get('OTS:PRIVATE:'+req.params.privateId, function (errP, replyP) {
        if (replyP) {
            client.get('OTS:SECRET:' + replyP.toString(), function (err, replyStr) {
                var reply = JSON.parse(replyStr);
                if (replyStr && reply) {
                    if (!reply['requirePassword'] || decrypt(reply['password']) === req.body['password']) {
                        client.del('OTS:SECRET:' + replyP.toString());
                        client.del('OTS:PRIVATE:' + req.params.privateId);
                        res.render('burned.ejs', {
                            title: 'OneTimeSecret - Secret Burned',
                            burnTime: new Date().toISOString()
                        });
                    } else {
                        res.render('confirm_burn', {
                            title: 'OneTimeSecret - View Secret',
                            requirePassword: reply['requirePassword'],
                            passwordError: true
                        });
                    }
                } else {
                    res.render('no_such_secret', { title: 'OneTimeSecret - Secret Not Available' });
                }
            });
        } else {
                res.render('no_such_secret', { title: 'OneTimeSecret - Secret Not Available' });
        }
    });
});


function encrypt(text) {
    var cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    var encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') }; //btoa(JSON.stringify({ iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') }));
}

function decrypt(text) {
    //var text = atob(JSON.parse(text64));
    var iv = Buffer.from(text.iv, 'hex');
    var encryptedText = Buffer.from(text.encryptedData, 'hex');
    var decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    var decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
module.exports = router;
