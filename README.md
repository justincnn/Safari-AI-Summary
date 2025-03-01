# Safari AI Summary

A powerful browser extension that adds AI-powered page summarization functionality to Safari. This userscript allows you to quickly generate concise summaries of any webpage using OpenAI's GPT model.

## Features

- 🤖 One-click AI summarization of web pages
- ⌨️ Customizable keyboard shortcuts for quick access
- 🎨 Clean and modern floating UI
- ✨ Markdown rendering support for better summary formatting
- 🔧 Configurable API settings and custom prompts
- 📋 Easy copy-to-clipboard functionality

## Installation

1. Install a userscript manager extension for Safari (like Tampermonkey)
2. Click [here](safari-ai-summary.user.js) to install the script
3. Configure your OpenAI API key in the settings

## Usage

1. Visit any webpage you want to summarize
2. Click the robot icon (🤖) in the bottom right corner or use the configured keyboard shortcut (default: Alt+A)
3. Wait for the AI to generate a summary
4. View the formatted summary in the popup window
5. Use the copy button to save the summary to your clipboard

## Configuration

Right-click the robot icon to access the configuration panel, where you can:

- Set your OpenAI API URL and API Key
- Customize the prompt used for summarization
- Configure your preferred keyboard shortcut

## Requirements

- Safari browser
- Userscript manager extension (e.g., Tampermonkey)
- OpenAI API key

## Technical Details

- Uses OpenAI's GPT-3.5-turbo model for summarization
- Implements marked.js for Markdown rendering
- Supports custom API endpoints
- Includes configurable content length limits

## Privacy

- All API keys are stored locally in your browser
- Page content is processed through your personal OpenAI API key
- No data is stored or transmitted to third parties

## License

MIT License

## Author

Justin Ye
