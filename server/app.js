var express = require('express');
    path    = require('path');

var app = express();
app.set('port', (process.env.PORT || 5000))

app.listen(app.get('port'), function () {
    console.log('Node app running at localhost:' + app.get('port'));
});

app.use('/', express.static(path.join(__dirname, '../')));
app.use('/', express.static(path.join(__dirname, '../css')));
app.use('/', express.static(path.join(__dirname, '../js')));
