# MAGI System - AI Consensus Review

This project implements a "MAGI-style" AI review system where three distinct AI personas (Melchior, Balthasar, Casper) discuss and analyze a given topic to reach a consensus.

## Features

- **Three Unique AI Personas**:
  - **MELCHIOR-1**: Scientist / Logical (Reasoning focused)
  - **BALTHASAR-2**: Mother / Protective (Safety/Ethics focused)
  - **CASPER-3**: Woman / Intuitive (Practical/Human focused)
- **Visual Interface**: Cyberpunk/Neon aesthetic inspired by the MAGI system interface.
- **Consensus Mechanism**: The system aggregates the decisions from all three cores to determine a final "GRANTED" or "DENIED" result.
- **OpenAI API Integration**: Uses OpenAI's GPT models (supports GPT-5.1/Mini) for analysis.
- **Slot Machine Randomization**: Randomly assigns personas to cores for varied perspectives.

## Usage

1. Open `index.html` in a modern web browser.
2. Click "SETTINGS" to enter your OpenAI API Key.
3. Select the desired Model.
4. Enter a topic in the input field (e.g., "Should we launch Project X?").
5. Click "ANALYZE" or press `Ctrl+Enter`.
6. Watch as the three cores debate and provide their individual verdicts.

## Tech Stack

- HTML5
- CSS3 (Grid, Flexbox, Animations)
- Vanilla JavaScript
- OpenAI API

## License

[MIT License](LICENSE)
