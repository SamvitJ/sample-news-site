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
                console.log("Saving new transaction");
                writeFull(res, articleId, clientId);

                var newTx = new Transaction({'_id': transactionId, 'clientId': clientId, 'articleId': articleId});
                newTx.save(function (saveErr) {
                    if (saveErr) {
                        throw saveErr;
                    } else {
                        console.log("Saved transaction");
                    }
                });
            }
        });
    } else {
        writePreview(res, articleId, clientId);
    }
});

function writePreview(res, articleId, clientId) {
    fs.readFile('./index.html', function(err, html) {
        if (!err) {
            res.writeHead(200, {
                'X-Article-Id': articleId,
                'X-Purchase-Price': '0.30',
                'Set-Cookie': "client-id=" + clientId
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
            res.writeHead(200, {
                'X-Article-Id': articleId,
                'X-Purchase-Price': '0.30',
                'Set-Cookie': "client-id=" + clientId
            });
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
