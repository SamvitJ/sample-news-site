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
var clients = {};
app.get('/', function(req, res) {
    var userTxId = req.headers['transaction-id'];

    var articleId = "5dK382jd9";
    var price = "0.30";

    var ipAddr = req.connection.remoteAddress
    if (!clients[ipAddr]) {
        clients[ipAddr] = uuid.v4();
        console.log("Assigned request id: ", clients[ipAddr]);
    } else {
        console.log("Found request id: ", clients[ipAddr]);
    }
    var requestId = clients[ipAddr];

    // check if user supplied a tx-id
    if (!userTxId) {
        writePreview(res, price, articleId, requestId);

    } else {
        var userReqId = req.headers['request-id'];
        var userSig;
        var userCert;

        // verify payment
        var https = require('https');
        var querystring = require('querystring');
        var data = querystring.stringify({
            "payKey": userTxId,
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
            console.log('/PaymentDetails status code: ', response.statusCode);

            response.on('data', function(chunk) {
                console.log('/PaymentDetails response: ' + chunk);
                var parsedResp = JSON.parse(chunk);

                if (parsedResp['responseEnvelope']['ack'] == "Success") {
                    console.log("Found transaction in PayPal");
                    var storedUserId = parsedResp['senderEmail'];
                    var storedArticleId = parsedResp['memo'];
                    var storedPrice = parsedResp['paymentInfoList']['paymentInfo'][0]['receiver']['amount'];
                    console.log('Fields (to be verified):', storedUserId, storedArticleId, storedPrice, userReqId);

                    // validate user request
                    if (price == storedPrice && articleId == storedArticleId
                        && requestId == userReqId) {
                        console.log("Validated user request!");
                        writeFull(res);
                    } else {
                        console.log("Error validating request");
                        writePreview(res, price, articleId, requestId);
                    }
                } else {
                    console.log("Error verifying payment");
                    writePreview(res, price, articleId, requestId);
                }
            });
        });

        request.write(data);
        request.end();
    }
});

function writePreview(res, price, articleId, requestId) {
    fs.readFile('./index.html', function(err, html) {
        if (!err) {
            res.writeHead(200, {
                'Connection': 'keep-alive',
                'X-Article-Id': articleId,
                'X-Purchase-Price': price,
                'X-Recipient': 'samvitj@princeton.edu',
                'X-Request-Id': requestId
            });
            res.write(html);
            res.end();
        } else {
            console.log("Error loading index.html\n");
        }
    });
}

function writeFull(res) {
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
