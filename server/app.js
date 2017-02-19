var express  = require('express');
    mongoose = require('mongoose');
    path     = require('path');
    uuid     = require('node-uuid');
    fs       = require('fs');

var app = express();

// config
app.set('port', (process.env.PORT || 5000))

var dbURI = 'mongodb://localhost:27017/database'
mongoose.connect(process.env.MONGODB_URI || dbURI, function (err) {
    if (err) {
        throw err;
    }
});

// data schemas
var txSchema = new mongoose.Schema({
    _id: String,
    articleId: String,
    clientId: String
});
var Transaction = mongoose.model('Transaction', txSchema);

// run
app.listen(app.get('port'), function () {
    console.log('Node app running at localhost:' + app.get('port'));
});

// handlers
app.get('/', function(req, res) {
    var transactionId = req.headers['transaction-id'];
    var clientId = req.headers['client-id'] || uuid.v4();
    var articleId = "5dK382jd9";
    if (transactionId) {
        Transaction.find({'_id': transactionId}, function(findErr, docs) {
            if (findErr) {
                writePreview(res, articleId, clientId);
                throw findErr;
            } else if (docs.length) {
                console.log("Found transaction: " + docs);
                writeFull(res, articleId, clientId);
            } else {
                // verify payment
                var https = require('https');
                var querystring = require('querystring');
                var data = querystring.stringify({
                    "payKey": transactionId,
                    "requestEnvelope.errorLanguage": "en_US"
                });
                var options = {
                    method: "POST",
                    host: "svcs.sandbox.paypal.com",
                    path: "/AdaptivePayments/PaymentDetails",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Content-Length": Buffer.byteLength(data, 'utf8'),
                        "X-PAYPAL-SECURITY-USERID": "samvit.jain_api1.gmail.com",
                        "X-PAYPAL-SECURITY-PASSWORD": "VJL2NXNEZXFQY3CB",
                        "X-PAYPAL-SECURITY-SIGNATURE": "An5ns1Kso7MWUdW4ErQKJJJ4qi4-AVGcZQd33mPK.B0RMlCTgGYW-gOk",
                        "X-PAYPAL-REQUEST-DATA-FORMAT": "NV",
                        "X-PAYPAL-RESPONSE-DATA-FORMAT": "JSON",
                        "X-PAYPAL-APPLICATION-ID": "APP-80W284485P519543T"
                    }
                }
                var request = https.request(options, function(response) {
                    console.log('PayPal POST /PaymentDetails status code: ', response.statusCode);
                    response.on('data', function(chunk) {
                        console.log('PayPal POST /PaymentDetails response: ' + chunk);
                        var ack = JSON.parse(chunk)['responseEnvelope']['ack'];
                        console.log('Ack: ' + ack);
                        if (ack == "Success") {
                            console.log("Verified payment! - saving new transaction");
                            writeFull(res, articleId, clientId);

                            var newTx = new Transaction({'_id': transactionId, 'clientId': clientId, 'articleId': articleId});
                            newTx.save(function (saveErr) {
                                if (saveErr) {
                                    throw saveErr;
                                } else {
                                    console.log("Saved transaction");
                                }
                            });
                        } else {
                            console.log("Error verifying payment");
                            writePreview(res, articleId, clientId);
                        }
                    });
                });

                request.write(data);
                request.end();
            }
        });
    } else {
        writePreview(res, articleId, clientId);
    }
});

function writePreview(res, articleId, clientId) {
    fs.readFile('./index.html', function(err, html) {
        if (!err) {
            var requestId = uuid.v4();
            res.writeHead(200, {
                'Connection': 'keep-alive',
                'X-Article-Id': articleId,
                'X-Purchase-Price': '0.30',
                'X-Recipient': 'samvitj@princeton.edu',
                'X-Request-Id': requestId
                //'Set-Cookie': "client-id=" + clientId
            });
            res.write(html);
            res.end();
        } else {
            console.log("Error loading index.html\n");
        }
    });
}

function writeFull(res, articleId, clientId) {
    fs.readFile('./index-full.html', function(err, html) {
        if (!err) {
            res.write(html);
            res.end();
        } else {
            console.log("Error loading index-full.html\n");
        }
    });
}

app.use('/', express.static(path.join(__dirname, '../')));
app.use('/', express.static(path.join(__dirname, '../css')));
app.use('/', express.static(path.join(__dirname, '../js')));

// close mongo connection
process.on('SIGINT', function() {
    mongoose.connection.close(function() {
        process.exit(0);
    });
});
