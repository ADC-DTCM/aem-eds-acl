# AEM EDS Accelerator

An Adobe Experience Manager (AEM) Edge Delivery Services accelerator project, built on the AEM boilerplate with WYSIWYG authoring.

## Environments

- Preview: https://main--aem-eds-acl--adc-dtcm.aem.page/
- Live: https://main--aem-eds-acl--adc-dtcm.aem.live/

## Documentation

Before working on this project, we recommend going through the documentation on [www.aem.live](https://www.aem.live/docs/) and [experienceleague.adobe.com](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/authoring), more specifically:

1. [Getting Started](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/edge-dev-getting-started), [Creating Blocks](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/create-block), [Content Modelling](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/content-modeling)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

Furthermore, we encourage you to watch the recordings of any previous presentations or sessions:

- [Getting started with AEM Authoring and Edge Delivery Services](https://experienceleague.adobe.com/en/docs/events/experience-manager-gems-recordings/gems2024/aem-authoring-and-edge-delivery)

## Prerequisites

- Node.js 18.3.x or newer
- AEM Cloud Service release 2024.8 or newer (>= `17465`)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

To auto-fix linting issues:

```sh
npm run lint:fix
```

## Building Component Models

```sh
npm run build:json
```

This merges the individual model JSON files from the `models/` directory into the root-level `component-models.json`, `component-definition.json`, and `component-filters.json`.

## Local Development

1. Install dependencies:

   ```sh
   npm i
   ```

2. Install the [AEM CLI](https://github.com/adobe/helix-cli) globally (one-time setup):

   ```sh
   npm install -g @adobe/aem-cli
   ```

3. Start the local AEM proxy server:

   ```sh
   aem up
   ```

   This opens your browser at `http://localhost:3000` with live reload. Any changes you make to blocks, scripts, or styles will be reflected immediately.

4. Open the project directory in your favorite IDE and start coding.

## Project Structure

| Path | Description |
| --- | --- |
| `blocks/` | Block components (cards, columns, hero, header, footer, etc.) |
| `fonts/` | Custom web fonts |
| `icons/` | SVG icons |
| `models/` | Component model definitions for WYSIWYG authoring |
| `scripts/` | Core JS (aem.js, scripts.js, editor support) |
| `styles/` | Global stylesheets |
| `tools/sidekick/` | Sidekick configuration |
