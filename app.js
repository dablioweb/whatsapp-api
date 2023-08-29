const { Client, MessageMedia, LocalAuth, Buttons } = require('whatsapp-web.js');
const createError = require('http-errors');
const express = require('express');
const mysql = require('mysql');
const dbconfig = require('./config/db.config');
const auth = require('./middleware/auth');
const errors = require('./middleware/error');
const {unless} = require('express-unless');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
let debug = require('debug')('login-api:server');
const jwt = require('jsonwebtoken')
const userController = require('./controllers/user.controller');
const usermodel = require('./models/usermodel');

//routers
const apiwebRouter = require('./routes/apiweb.js');
const loginRouter = require('./routes/login.js');
const usersRouter = require('./routes/users.js');
const registroRouter = require('./routes/registro.js');
const dbConfig = require('./config/db.config');
const { response } = require('express');

const app = express();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload({
  debug: false
}));

//routers
app.get('/logout', (req, res) => {
  // clear the cookie
  res.clearCookie("access_token");
  // redirect to login
  return res.redirect("/login");
});

app.use("/login", loginRouter);
//app.use("/users", usersRouter);
app.use("/registro", registroRouter);
app.use("/apiweb", apiwebRouter);
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.post('/auth', function (req, res, next) {
 console.log('auth')
  userController.autht(req, res, function (err, user) {
    if (err) {
      res.end("Error: " + err);
    } else {
      if (user) {
        req.session.user = user.email;
        res.end("logado");
      } else {
        res.end("Usuario Invalido");
      }
    }
  });
});

//unless awt
/*
 auth.authenticateToken.unless = unless;
 app.use(
   auth.authenticateToken.unless({
     path: [
       { url: '/', methods: ['GET', 'PUT', 'POST'] },
       { url: '/login', methods: ['GET', 'PUT', 'POST'] },
       { url: '/registro', methods: ['GET', 'PUT', 'POST'] },
       { url: '/socket.io', methods: ['GET', 'PUT', 'POST'] },
       { url: '/auth', methods: ['GET', 'PUT', 'POST'] },
     ],
   })
 );
*/
// WHATSAPP WEB API
let podecriar = true;
global.podecriar = true;
const server = http.createServer(app);

const io = socketIO(server);

const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch (err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function (sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = async function (id, description, webhook, email) {
  let email2 = global.emailvalor

  // pega o maximo de sessões da database
  const getMaxSessionsByEmail = usermodel.getMaxSessionsByEmail;
  let maxSessions = await getMaxSessionsByEmail(email2);
  console.log(maxSessions)
  if (maxSessions === null || maxSessions === undefined) {
    maxSessions = 3;
  }

  // filtra o array com apenas emails iguais ao email da sessão
  console.log(email2)
  const userSessions = sessions.filter((session) => session.email === email2);

  // se o filtro for maior ou igual ao maximo de sessões, retorna
  if (userSessions.length >= maxSessions) {
    io.emit('maxreached', { email: email, text: 'Voce Atingiu o limite de sessões' });
    global.podecriar = false;
    podecriar = false;
  }else{
    podecriar = true;
    global.podecriar = true;
  }

 if(podecriar) {
  let email2 = global.emailvalor
  console.log(email2)
  console.log('Creating session: ' + id);
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    authStrategy: new LocalAuth({
      clientId: id
    })
  });

  client.initialize();

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { id: id, src: url });
      io.emit('message', { id: id, text: 'QR Code received, scan please!' });
    });
  });

  client.on('ready', () => {
    io.emit('ready', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is ready!' });

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
  });

  client.on('message', async (msg) => {
    /*if (msg.body == '!ping') {
        msg.reply('pong');
    }*/
    try {
      if (webhook != "" && webhook != null) {
        let chat = await msg.getChat();
        const searchOptions = {
          limit: 1,
          fromMe: true
        };
        chat.sendStateTyping()
        var lastMessages = await chat.fetchMessages(searchOptions)
        var lastMessage = lastMessages[0];
        var ultimamsg = lastMessage.body
        let response = await getResponseWebhook(webhook, msg, id, ultimamsg);
        console.log("resposta: " + JSON.stringify(response));
        response.reply.forEach(responseReceived => {
          msg.reply(responseReceived.message);
          chat.clearState()
        });
      }
    } catch (e) {
      console.log("sem resposta")
    }
  });

  client.on('authenticated', () => {
    io.emit('authenticated', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is authenticated!' });
  });

  client.on('auth_failure', function () {
    io.emit('message', { id: id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected!' });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', id);
  });
 if(email == undefined){
   sessions.push({
     id: id,
     description: description,
     client: client,
     webhook: webhook,
     email: email2,
   });
 } else {
   sessions.push({
     id: id,
     description: description,
     client: client,
     webhook: webhook,
     email: email,
   });
   }


  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      webhook: webhook,
      description: description,
      email: email2,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
 } else {
   console.log("nao pode criar")
 }
}

const init = function (socket) {
  const savedSessions = getSessionsFile();
  if (savedSessions.length > 0) {
    if (socket) {
      /**
       * At the first time of running (e.g. restarting the server), our client is not ready yet!
       * It will need several time to authenticating.
       *
       * So to make people not confused for the 'ready' status
       * We need to make it as FALSE for this condition
       */
      savedSessions.forEach((e, i, arr) => {
        arr[i].ready = false;
      });

      socket.emit('init', savedSessions);
    } else {
      savedSessions.forEach(sess => {
        createSession(sess.id, sess.description, sess.webhook, sess.email);
      });
    }
  }
}

init();

// Socket IO
io.on('connection', function (socket) {
  init(socket);

  socket.on('create-session', function (data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description, data.webhook, data.email);
  });
});

app.post('/send-buttons', async (req, res) => {
  console.log("Enviando Botão!");
  //console.log(req);
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  //const reply = new Buttons(message, [{body: 'Test', id: 'test-1'}], "title", 'footer') // Reply button
  //const reply_url = new Buttons(message, [{id:'customId',body:'button1'},{body:'button2'},{body:'button3'},{body:'button4'}], 'title', 'footer') // Reply button with URL
  //const reply_call = new Buttons(message, [{body: 'Test', id: 'test-1'}, {body: "Test 2 Call", url: "+1 (234) 567-8901"}], 'title', 'footer') // Reply button with call button
  const reply_call_url = new Buttons(message, [{ body: 'Test', id: 'test-1' }, { body: "Test 2 Call", url: "+1 (234) 567-8901" }, { body: 'Test 3 URL', url: 'https://wwebjs.dev' }], 'title', 'footer') // Reply button with call button & url button
  console.log(reply_call_url);

  let email = null
  const jwtCookie = req.cookies['access_token'];
  if (jwtCookie) {
    try {
      const decodedToken = jwt.verify(jwtCookie, process.env.ACCESS_TOKEN_SECRET);
      email = decodedToken.data;
      console.log(email)
    } catch (err) {
      console.log(err)
    }
  } else {
    console.log('sem cookies')
  }
  console.log(sessions)
  const client = sessions.find(sess => sess.id == sender)?.client;
  if (email !== sessions.find(sess => sess.email === email)?.email) {
    return res.status(422).json({
      status: false,
      message: `Credenciais Incorretas`
    })
  }
  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    })
  }

  const isRegisteredNumber = await checkRegisteredNumber(client, number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  client.sendMessage(number, reply_call_url).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

const checkRegisteredNumber = async function (client, number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Send message
app.post('/send-message', async (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = JSON.parse(`"${req.body.message}"`);
  let email = null
  const jwtCookie = req.cookies['access_token'];
  if (jwtCookie) {
    try {
      const decodedToken = jwt.verify(jwtCookie, process.env.ACCESS_TOKEN_SECRET);
      email = decodedToken.data;
      console.log(email)
    } catch (err) {
      console.log(err)
    }
  } else {
    console.log('sem cookies')
  }
  console.log(sessions)
  const client = sessions.find(sess => sess.id == sender)?.client;
  if (email !== sessions.find(sess => sess.email === email)?.email){
    return res.status(422).json({
      status: false,
      message: `Credenciais Incorretas`
    })
  }
  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    })
  }

  /**
   * Check if the number is already registered
   * Copied from app.js
   *
   * Please check app.js for more validations example
   * You can add the same here!
   */
  const isRegisteredNumber = await client.isRegisteredUser(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

/*Envia midias*/
app.post('/send-media', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req?.files != null ? req.files.file : req.body.file;
  const sender = req.body.sender;

  let email = null
  const jwtCookie = req.cookies['access_token'];
  if (jwtCookie) {
    try {
      const decodedToken = jwt.verify(jwtCookie, process.env.ACCESS_TOKEN_SECRET);
      email = decodedToken.data;
      console.log(email)
    } catch (err) {
      console.log(err)
    }
  } else {
    console.log('sem cookies')
  }
  console.log(sessions)
  const client = sessions.find(sess => sess.id == sender)?.client;
  if (email !== sessions.find(sess => sess.email === email)?.email) {
    return res.status(422).json({
      status: false,
      message: `Credenciais Incorretas`
    })
  }
  console.log(fileUrl)
  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    });
  }

  if (!fileUrl) {
    return res.status(400).json({
      status: false,
      message: "fileUrl argument is missing or invalid"
    });
  }
  let media = null;
  let mimetype;
  if (req?.files == null) {
    const attachment = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    }).then(response => {
      mimetype = response.headers['content-type'];
      return response.data.toString('base64');
    }); media = new MessageMedia(mimetype, attachment, 'Media');
  } else {

    file = req.files.file;
    media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  }

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});


/*Envia midias*/
app.post('/send-ptt', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req?.files != null ? req.files.file : req.body.file;
  const sender = req.body.sender;

  let email = null
  const jwtCookie = req.cookies['access_token'];
  if (jwtCookie) {
    try {
      const decodedToken = jwt.verify(jwtCookie, process.env.ACCESS_TOKEN_SECRET);
      email = decodedToken.data;
      console.log(email)
    } catch (err) {
      console.log(err)
    }
  } else {
    console.log('sem cookies')
  }
  console.log(sessions)
  const client = sessions.find(sess => sess.id == sender)?.client;
  if (email !== sessions.find(sess => sess.email === email)?.email) {
    return res.status(422).json({
      status: false,
      message: `Credenciais Incorretas`
    })
  }

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    })
  }
  if (!fileUrl) {
    return res.status(400).json({
      status: false,
      message: "fileUrl argument is missing or invalid"
    });
  }
  let media = null;
  let mimetype;
  if (req?.files == null) {
    const attachment = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    }).then(response => {
      mimetype = response.headers['content-type'];
      return response.data.toString('base64');
    }); media = new MessageMedia(mimetype, attachment, 'Media');
  } else {

    file = req.files.file;
    media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  }

  client.sendMessage(number, media, {
    sendAudioAsVoice: true,
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

async function getResponseWebhook(url, message, sender, ultimamsg) {
  let requestDefaultString = JSON.stringify({
    "appName": "zapflow",
    "query": {
      "sender": sender,
      "message": message.body,
      "isGroup": false,
      "isMedia": message.hasMedia,
      "ruleId": message.from,
      "lastmessage": ultimamsg
    }
  });

  console.log("Enviando data: " + JSON.stringify(requestDefaultString));

  let res = await axios({
    method: 'POST',
    url,
    data: requestDefaultString,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
  if (res.status == 200) {
    return res.data;
  }
  return null;
}

async function getMyLastMessage(number) {

  var myMessage = "NotFound";
  var chat = await getChatModelByNumber(number);
  var msgs = chat.msgs._models;

  try {
    for (var i = 0; i < msgs.length; i++) {

      if (msgs[i].x_isSentByMe !== null && msgs[i].x_isSentByMe !== undefined) {
        if (msgs[i].x_isSentByMe === true) {
          myMessage = msgs[i].x_text;
        }
      }

    }
  } catch (e) {

  }

  return myMessage;

}

async function getChatModelByNumber(number) {

  var chats = window.Store.Chat._models;
  var chatID;

  for (var c = 0; c < chats.length; c++) {

    if (chats[c].x_id !== null) {
      if (chats[c].x_id.user === number) {
        chatID = chats[c];
      }
    }

  }

  return chatID;

}

app.get('/get-podecriar', function (req, res) {
  res.send(global.podecriar);
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


/**
 * Get port from environment and store in Express.
 */

let port = normalizePort(process.env.PORT || '8001');
app.set('port', port);


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  let port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}




module.exports = app;
