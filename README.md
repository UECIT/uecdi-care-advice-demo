# PCI - Post Call Information

## Overview
This service primarily implements a page showing a patient details about a clinical encounter after it ended.

The Post Call Information (PCI) service is responsible for accepting a reference to an Encounter, retrieving the associated Encounter Report and displaying it to the patient in a human-readable form.

This proof of concept implementation is compliant with v2.0 of the CDS API Spec and supports:
- accepting an absolute reference to an Encounter
- serving a page showing human-readable Encounter Report details

## Source Code Location
The repository for this project is located in a public GitLab space here: https://gitlab.com/ems-test-harness/uecdi-care-advice-demo

## Usage/Invocation
### Prerequisites
To clone the project:
```bash
git clone git@gitlab.com:ems-test-harness/uecdi-care-advice-demo.git
```
or
```bash
git clone https://gitlab.com/ems-test-harness/uecdi-care-advice-demo.git
```

Additionally you should have [node.js](https://nodejs.org/en/download/) installed.

### Build steps
This project is configured to run on port 5000. For local machines, this can be accessed at http://localhost:5000.
To run the FHIR server, simply run the npm command:

```bash
npm start
```

### Live usage
In general, the PCI page should be accessed through the UI of the EMS by invoking the appropriate service at the end of the triage journey.

However, should you wish to run it in isolation, the endpoint for viewing the report is: `GET /report?encounter=[fullEncounterUrl]`

## Project Structure
### Implementation
The PCI page is a node.js [express](https://expressjs.com/) application structured after the NHS provided skeleton. The backend is split into the following layers:
1. Data layer - contains data models and logic to pull in specific Encounter Report details
2. Service layer - contains logic to populate a view model
3. The main application layer - primarily the app.js  file, contains middleware and routing logic

### UI
The front end is server-rendered via nunjucks templates. Static files are gulped from app/assets  while the views are under app/views .

### Tests
No tests are provided for the Post Call Information application.

## Deployment
The CI pipeline in GitLab is configured to create a zip file for each commit for the commit sha. For non-develop branches, a single zip file is made with that branch name and they are made available for deployment as artifacts.