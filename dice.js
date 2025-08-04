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
      if (parts.length === 0) {
        throw new Error('Each die needs at least one face!');
      }

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

class SecureRandom {
  static generateKey() {
    return crypto.randomBytes(32);
  }

  static computeHMAC(key, number) {
    const algo = crypto.getHashes().includes('sha3-256') ? 'sha3-256' : 'sha256';
    return crypto.createHmac(algo, key).update(number.toString()).digest('hex').toUpperCase();
  }
}

// bias-free random integer
function secureRandomIndex(max) {
  if (max < 0) throw new Error('max must be non-negative');
  if (max === 0) return 0;
  
  const range = BigInt(max + 1);
  const bits = range.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const mask = (BigInt(1) << BigInt(bits)) - BigInt(1);
  while (true) {
    const buf = crypto.randomBytes(bytes);
    let value = BigInt(0);
    for (let i = 0; i < bytes; i++) {
      value = (value << BigInt(8)) + BigInt(buf[i]);
    }
    value = value & mask;
    if (value < range) return Number(value);
  }
}

class FairRandomGenerator {
  constructor(max) {
    this.max = max;
    this.key = SecureRandom.generateKey();
    // secure random number
    this.computerNumber = secureRandomIndex(max);
    this.hmac = SecureRandom.computeHMAC(this.key, this.computerNumber);
  }

  getHMAC() {
    return this.hmac;
  }

  computeResult(userNumber) {
    return (this.computerNumber + userNumber) % (this.max + 1);
  }

  getKey() {
    return this.key.toString('hex').toUpperCase();
  }

  getComputerNumber() {
    return this.computerNumber;
  }
}

class CoinFlip {
  static async decideFirstPlayer() {
    console.log("Let's decide who picks first with a provably fair coin flip.");
    const generator = new FairRandomGenerator(1); // 0 or 1
    console.log('Computer has chosen (hidden). HMAC: ' + generator.getHMAC());
    console.log('You pick 0 or 1:');
    console.log('0 - 0');
    console.log('1 - 1');
    console.log('X - exit');
    console.log('? - help');

    const userChoice = await Game.getUserInputStatic(1);
    if (userChoice === null) return null;

    const result = (generator.getComputerNumber() + userChoice) % 2;
    const computerFirst = result === 0;

    console.log(
      `Reveal: Computer number = ${generator.getComputerNumber()} (Key: ${generator.getKey()})`
    );
    console.log(
      `Computed result = (computer + user) % 2 = (${generator.getComputerNumber()} + ${userChoice}) % 2 = ${result}`
    );
    console.log(computerFirst ? 'Computer picks first!' : 'You pick first!');

    return computerFirst;
  }
}

class Game {
  constructor(dice) {
    this.dice = dice;
    this.computerDie = null;
    this.userDie = null;
  }

  async run() {
    const computerFirst = await CoinFlip.decideFirstPlayer();
    if (computerFirst === null) return;

    if (computerFirst) {
      this.computerDie = this.dice[secureRandomIndex(this.dice.length - 1)];
      console.log('Computer picks die: [' + this.computerDie.faces.join(',') + ']');
      await this.selectUserDie();
    } else {
      await this.selectUserDie();
      this.computerDie = this.dice[secureRandomIndex(this.dice.length - 1)];
      console.log('Computer picks die: [' + this.computerDie.faces.join(',') + ']');
    }

    if (!this.userDie || !this.computerDie) return;

    const computerRollFace = await this.computerRoll();
    if (computerRollFace === null) return;

    const userRollFace = await this.userRoll();
    if (userRollFace === null) return;

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
            console.log('Type 0 or 1 to choose, X to exit.');
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

  async computerRoll() {
    console.log('\nComputer rolling:');
    const generator = new FairRandomGenerator(this.computerDie.numFaces - 1);
    console.log(
      `Computer has hidden number. HMAC: ${generator.getHMAC()} (mod ${this.computerDie.numFaces})`
    );
    console.log(`Add your number (mod ${this.computerDie.numFaces}):`);
    this.showOptions(this.computerDie.numFaces - 1);

    const userNumber = await this.getUserInput(this.computerDie.numFaces - 1);
    if (userNumber === null) return null;

    const result = generator.computeResult(userNumber);
    console.log(
      `Reveal: Computer number = ${generator.getComputerNumber()} (Key: ${generator.getKey()})`
    );
    console.log(
      `Computed result = (computer + user) % ${this.computerDie.numFaces} = (${generator.getComputerNumber()} + ${userNumber}) % ${this.computerDie.numFaces} = ${result}`
    );
    return this.computerDie.getFace(result);
  }

  async userRoll() {
    console.log('\nYour rolling:');
    const generator = new FairRandomGenerator(this.userDie.numFaces - 1);
    console.log(
      `Computer (hidden) number for your roll. HMAC: ${generator.getHMAC()} (mod ${this.userDie.numFaces})`
    );
    console.log(`Add your number (mod ${this.userDie.numFaces}):`);
    this.showOptions(this.userDie.numFaces - 1);

    const userNumber = await this.getUserInput(this.userDie.numFaces - 1);
    if (userNumber === null) return null;

    const result = generator.computeResult(userNumber);
    console.log(
      `Reveal: Computer number = ${generator.getComputerNumber()} (Key: ${generator.getKey()})`
    );
    console.log(
      `Computed result = (computer + user) % ${this.userDie.numFaces} = (${generator.getComputerNumber()} + ${userNumber}) % ${this.userDie.numFaces} = ${result}`
    );
    return this.userDie.getFace(result);
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
