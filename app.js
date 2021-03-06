// Core dependencies
const path = require('path')
const fs = require('fs')

// External dependencies
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const express = require('express');
const nunjucks = require('nunjucks');
const sessionInCookie = require('client-sessions')
const sessionInMemory = require('express-session')

// Run before other code to make sure variables from .env are available
dotenv.config()

// Local dependencies
const authentication = require('./middleware/authentication');
const automaticRouting = require('./middleware/auto-routing');
const config = require('./app/config');
const locals = require('./app/locals');
const routes = require('./app/routes');
const documentationRoutes = require('./docs/documentation_routes');
const utils = require('./lib/utils.js');

const reports = require('./app/services/report-service.js');

// Set configuration variables
const port = 5000;
const useDocumentation = process.env.SHOW_DOCS || config.useDocumentation;
const onlyDocumentation = process.env.DOCS_ONLY;

// Initialise applications
const app = express();
const cors = require('cors');
app.use(cors());
const documentationApp = express();

// Set up configuration variables
var useAutoStoreData = process.env.USE_AUTO_STORE_DATA
    || config.useAutoStoreData
var useCookieSessionStore = process.env.USE_COOKIE_SESSION_STORE
    || config.useCookieSessionStore

// Add variables that are available in all views
app.locals.asset_path = '/public/'
app.locals.useAutoStoreData = (useAutoStoreData === 'true')
app.locals.useCookieSessionStore = (useCookieSessionStore === 'true')
app.locals.serviceName = config.serviceName

// Nunjucks configuration for application
var appViews = [
  path.join(__dirname, 'app/views/'),
  path.join(__dirname, 'node_modules/nhsuk-frontend/packages/components'),
  path.join(__dirname, 'docs/views/')
]

var nunjucksConfig = {
  autoescape: true
}

nunjucksConfig.express = app

var nunjucksAppEnv = nunjucks.configure(appViews, nunjucksConfig)

// Add Nunjucks filters
utils.addNunjucksFilters(nunjucksAppEnv)

// Session uses service name to avoid clashes with other prototypes
const sessionName = 'uecdi-care-advice-demo' + (Buffer.from(config.serviceName,
    'utf8')).toString('hex')
let sessionOptions = {
  secret: sessionName,
  cookie: {
    maxAge: 1000 * 60 * 60 * 4 // 4 hours
  }
}

// Support session data in cookie or memory
if (useCookieSessionStore === 'true') {
  app.use(sessionInCookie(Object.assign(sessionOptions, {
    cookieName: sessionName,
    proxy: true,
    requestKey: 'session'
  })))
} else {
  app.use(sessionInMemory(Object.assign(sessionOptions, {
    name: sessionName,
    resave: false,
    saveUninitialized: false
  })))
}

// Support for parsing data in POSTs
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}))

// Automatically store all data users enter
if (useAutoStoreData === 'true') {
  app.use(utils.autoStoreData)
  utils.addCheckedFunction(nunjucksAppEnv)
}

// initial checks
checkFiles()

// Warn if node_modules folder doesn't exist
function checkFiles() {
  const nodeModulesExists = fs.existsSync(path.join(__dirname, '/node_modules'))
  if (!nodeModulesExists) {
    console.error(
        'ERROR: Node module folder missing. Try running `npm install`')
    process.exit(0)
  }

  // Create template .env file if it doesn't exist
  const envExists = fs.existsSync(path.join(__dirname, '/.env'))
  if (!envExists) {
    fs.createReadStream(path.join(__dirname, '/lib/template.env'))
    .pipe(fs.createWriteStream(path.join(__dirname, '/.env')))
  }
}

// Create template session data defaults file if it doesn't exist
const dataDirectory = path.join(__dirname, '/app/data')
const sessionDataDefaultsFile = path.join(dataDirectory,
    '/session-data-defaults.js')
const sessionDataDefaultsFileExists = fs.existsSync(sessionDataDefaultsFile)

if (!sessionDataDefaultsFileExists) {
  console.log('Creating session data defaults file')
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory)
  }

  fs.createReadStream(
      path.join(__dirname, '/lib/template.session-data-defaults.js'))
  .pipe(fs.createWriteStream(sessionDataDefaultsFile))
}

// Check if the app is documentation only
if (onlyDocumentation !== 'true') {
  // Require authentication if not
  app.use(authentication);
}

// Local variables
app.use(locals(config));

// View engine
app.set('view engine', 'html');
documentationApp.set('view engine', 'html');

// Middleware to serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/nhsuk-frontend', express.static(
    path.join(__dirname, 'node_modules/nhsuk-frontend/packages')));
app.use('/nhsuk-frontend',
    express.static(path.join(__dirname, 'node_modules/nhsuk-frontend/dist')));

// Check if the app is documentation only
if (onlyDocumentation == 'true') {
  app.get('/', function (req, res) {
    // Redirect to the documentation pages if it is
    res.redirect('/docs');
  });
} else {
  // Else use custom application routes
  app.use('/', routes);
}

// Automatically route pages
app.get(/^([^.]+)$/, function (req, res, next) {
  automaticRouting.matchRoutes(req, res, next)
})

// Database connectivity
const Sequelize = require("sequelize");
const database = new Sequelize({
  dialect: 'mysql',
  database: 'cdss_uecdi',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
});

const handoverMessageEntry = database.define("handover", {
  handoverId: {
    type: Sequelize.BIGINT,
    primaryKey: true
  },
  handoverJson: new Sequelize.TEXT('medium')
}, {
  timestamps: false
});

// Route post to handover page
app.post("/handover", function (req, res, next) {
  const handoverMessage = req.body;
  console.info("Saving handover " + handoverMessage.id);
  handoverMessageEntry.sync({
    force: false
  }).then(() => {
    return handoverMessageEntry.create({
      handoverId: handoverMessage.id,
      handoverJson: JSON.stringify(handoverMessage)
    });
  });
  res.send(200, JSON.stringify(handoverMessage));
});

// Route Get to handover page
app.get('/handover/list', function (req, res, next) {
  console.info("Retrieving all handover messages");
  handoverMessageEntry.findAll({
    attributes: ['handoverId'],
  }).then(handoverList => {
    console.log("All handover messages:", JSON.stringify(handoverList));
    res.render("handoverList.html", {
      "handoverList": handoverList
    });
  });
});

// Route Get to handover page
app.get('/handover/:id', function (req, res, next) {
  console.info("Retrieving handover " + req.params.id);
  handoverMessageEntry.findByPk(req.params.id).then(handover => {
    console.log("handover message:", JSON.stringify(handover));
    const handoverMessage = JSON.parse(handover.handoverJson);
    res.render("handover.html", {
      "handoverMessage": handoverMessage
    });
  });
});

function parseUrl(url, origin) {

  // Captures an absolute url that ends with Encounter/*
  const absoluteUrlPattern = /^(https?:\/\/(?:[^\/]+\/)*)Encounter\/([^\/]+\/?)$/;

  // Captures a relative url that ends with Encounter/*
  const relativeUrlPattern = /^\/(?:[^\/]+\/)*Encounter\/[^\/]+\/?$/;

  if (relativeUrlPattern.test(url)) {
    if (origin.endsWith("/")) {
      origin = origin.slice(0, -1);
    }
    url = origin + url;
  }

  if (absoluteUrlPattern.test(url)) {
    const [, host, encounterId] = absoluteUrlPattern.exec(url);
    return {host, encounterId};
  }

  return {host: undefined, encounterId: undefined};
}

// Route post to encounter report
app.get('/report', async function (req, res, next) {
  const {host, encounterId} = parseUrl(req.query.encounter, req.get("referer"));
  if (!host) {
    res.status(400).send("Could not parse " + req.query.encounter);
    return;
  }

  try {
    const report = await reports.getReport(encounterId, host);
    let input = {
      encounter: report.encounter(),
      appointment: report.appointment(),
      patient: await report.patient(),
      gp: await report.gp(),
      referralRequest: report.referralRequest(),
      handoverMessage: report.handoverMessage(),
      selectedService: await report.selectedService(),
      selectedServiceLocation: await report.selectedServiceLocation(),
      observations: report.observations(),
      conditions: report.conditions(),
      carePlans: report.carePlans()
    };
    // console.log(input);
    res.render("handover.html", input);
  } catch (e) {
    console.log(e.stack);
    res.status(500).send("Failed to process report: " + e.message);
  }
});

// Check if the app is using documentation
if (useDocumentation || onlyDocumentation == 'true') {
  // Documentation routes
  app.use('/docs', documentationApp);

  // Nunjucks configuration for documentation
  var docViews = [
    path.join(__dirname, 'docs/views/'),
    path.join(__dirname, 'node_modules/nhsuk-frontend/packages/components')
  ]

  var nunjucksAppEnv = nunjucks.configure(docViews, {
    autoescape: true,
    express: documentationApp
  });

  // Add Nunjucks filters
  utils.addNunjucksFilters(nunjucksAppEnv)

  // Automatically store all data users enter
  if (useAutoStoreData === 'true') {
    documentationApp.use(utils.autoStoreData)
    utils.addCheckedFunction(nunjucksAppEnv)
  }

  // Support for parsing data in POSTs
  documentationApp.use(bodyParser.json());
  documentationApp.use(bodyParser.urlencoded({
    extended: true
  }))

  // Custom documentation routes
  documentationApp.use('/', documentationRoutes);

  // Automatically route documentation pages
  documentationApp.get(/^([^.]+)$/, function (req, res, next) {
    automaticRouting.matchRoutes(req, res, next)
  })

}

// Clear all data in session if you open /examples/passing-data/clear-data
app.post('/examples/passing-data/clear-data', function (req, res) {
  req.session.data = {}
  res.render('examples/passing-data/clear-data-success')
})

// Redirect all POSTs to GETs - this allows users to use POST for autoStoreData
app.post(/^\/([^.]+)$/, function (req, res) {
  res.redirect('/' + req.params[0])
})

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error(`Page not found: ${req.path}`)
  err.status = 404
  next(err)
})

// Display error
app.use(function (err, req, res, next) {
  console.error(err.message)
  res.status(err.status || 500)
  res.send(err.message)
})

// Run the application
app.listen(port, () => console.log("Listening on port " + port));

module.exports = app;
