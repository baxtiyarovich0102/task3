const AsciiTable = require('ascii-table');
const crypto = require('crypto');
const readline = require('readline');

class Dice {
  constructor(faces) {
    this.faces = faces;
    this.numFaces = faces.length;
  }

  getFace(index) {
    return this.faces[index % this.numFaces];
  }
}

class DiceParser {
  static parseDice(args) {
    if (args.length < 3) {
      throw new Error(
        'You need at least 3 dice. Example: node dice_game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3'
      );
    }

    const dice = [];
    for (const arg of args) {
      const parts = arg.split(',');
      const faces = parts.map((numStr) => {
        const num = Number(numStr);
        if (!Number.isInteger(num)) {
          throw new Error('Not a number: ' + numStr);
        }
        return num;
      });

      dice.push(new Dice(faces));
    }
    return dice;
  }
}

class ProbabilityCalculator {
  static winProbability(die1, die2) {
    let wins = 0;
    const total = die1.numFaces * die2.numFaces;
    for (let i = 0; i < die1.numFaces; i++) {
      for (let j = 0; j < die2.numFaces; j++) {
        if (die1.getFace(i) > die2.getFace(j)) wins++;
      }
    }
    return total > 0 ? wins / total : 0;
  }

  static generateProbabilityTable(dice) {
    const table = new AsciiTable('Win Chances');
    table.setHeading('', ...dice.map((_, i) => 'Die ' + i));
    for (let i = 0; i < dice.length; i++) {
      const row = ['Die ' + i];
      for (let j = 0; j < dice.length; j++) {
        if (i === j) row.push('-');
        else row.push((this.winProbability(dice[i], dice[j]) * 100).toFixed(2) + '%');
      }
      table.addRow(...row);
    }
    return table.toString();
  }
}

class Game {
  constructor(dice) {
    this.dice = dice;
    this.computerDie = null;
    this.userDie = null;
  }

  async run() {
    const computerFirst = crypto.randomInt(0, 2) === 0;
    console.log(computerFirst ? 'Computer picks first!' : 'You pick first!');

    if (computerFirst) {
      this.computerDie = this.pickRandomDie();
      console.log('Computer picks die: [' + this.computerDie.faces.join(',') + ']');
      await this.selectUserDie();
    } else {
      await this.selectUserDie();
      this.computerDie = this.pickRandomDie();
      console.log('Computer picks die: [' + this.computerDie.faces.join(',') + ']');
    }

    if (!this.userDie || !this.computerDie) return;

    const computerRollFace = this.computerRoll();
    const userRollFace = await this.userRoll();

    console.log('Your roll: ' + userRollFace);
    console.log('Computer roll: ' + computerRollFace);

    if (userRollFace > computerRollFace) {
      console.log(`You win! (${userRollFace} > ${computerRollFace})`);
    } else if (computerRollFace > userRollFace) {
      console.log(`Computer wins! (${computerRollFace} > ${userRollFace})`);
    } else {
      console.log(`It's a tie! (${userRollFace} = ${computerRollFace})`);
    }

    console.log('\nPairwise win probability table:');
    console.log(ProbabilityCalculator.generateProbabilityTable(this.dice));
  }

  pickRandomDie() {
    return this.dice[crypto.randomInt(0, this.dice.length)];
  }

  showOptions(max) {
    for (let i = 0; i <= max; i++) {
      console.log(`${i} - ${i}`);
    }
    console.log('X - exit');
    console.log('? - help');
  }

  static async getUserInputStatic(max) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      const prompt = () => {
        rl.question('Your choice: ', (inputRaw) => {
          const input = inputRaw.trim().toUpperCase();
          if (input === 'X') {
            console.log('Game cancelled.');
            rl.close();
            resolve(null);
          } else if (input === '?') {
            console.log(`Type a number from 0 to ${max}, or X to exit.`);
            prompt();
          } else {
            const num = Number(input);
            if (!Number.isInteger(num) || num < 0 || num > max) {
              console.log(`Pick a number between 0 and ${max}, X to exit, or ? for help.`);
              prompt();
            } else {
              rl.close();
              resolve(num);
            }
          }
        });
      };
      prompt();
    });
  }

  async getUserInput(max) {
    return Game.getUserInputStatic(max);
  }

  async selectUserDie() {
    console.log('Pick your die:');
    this.dice.forEach((die, i) => {
      console.log(`${i} - [${die.faces.join(',')}]`);
    });
    console.log('X - exit');
    console.log('? - help');

    const choice = await this.getUserInput(this.dice.length - 1);
    if (choice !== null) {
      this.userDie = this.dice[choice];
      console.log('You picked: [' + this.userDie.faces.join(',') + ']');
    }
  }

  computerRoll() {
    const rollIndex = crypto.randomInt(0, this.computerDie.numFaces);
    return this.computerDie.getFace(rollIndex);
  }

  async userRoll() {
    console.log('\nYour rolling:');
    this.showOptions(this.userDie.numFaces - 1);

    const userIndex = await this.getUserInput(this.userDie.numFaces - 1);
    if (userIndex === null) return null;

    return this.userDie.getFace(userIndex);
  }
}

async function main() {
  try {
    const dice = DiceParser.parseDice(process.argv.slice(2));
    const game = new Game(dice);
    await game.run();
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

main();
