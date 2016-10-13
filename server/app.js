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
    fs.readFile('./index.html', function(err, html) {
        if (!err) {
            var transactionId = req.headers['transaction-id'];
            var clientId = req.headers['client-id'] || uuid.v4();
            if (transactionId) {
                Transaction.find({'_id': transactionId}, function(findErr, docs) {
                    if (findErr) {
                        throw findErr;
                    } else if (docs.length) {
                        console.log("Found transaction: " + docs);
                    } else {
                        var newTx = new Transaction({'_id': transactionId, 'clientId': clientId, 'articleId': '1'});
                        newTx.save(function (saveErr) {
                            if (saveErr) {
                                throw saveErr;
                            } else {
                                console.log("Saved transaction");
                            }
                        });
                    }
                });
            }
            res.writeHead(200, {
                'X-Article-Id': '5dK382jd9',
                'X-Purchase-Price': '0.30',
                'Set-Cookie': "client-id=" + clientId
            });
            res.write(html);
            res.end();
        }
    });
});

app.use('/', express.static(path.join(__dirname, '../')));
app.use('/', express.static(path.join(__dirname, '../css')));
app.use('/', express.static(path.join(__dirname, '../js')));

// close mongo connection
process.on('SIGINT', function() {
    mongoose.connection.close(function() {
        process.exit(0);
    });
});
