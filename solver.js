(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MatrixSolver = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const EPSILON = 1e-10;

  class Fraction {
    constructor(numerator = 0n, denominator = 1n) {
      let n = BigInt(numerator);
      let d = BigInt(denominator);
      if (d === 0n) throw new Error('No se puede construir una fracción con denominador cero.');
      if (d < 0n) { n = -n; d = -d; }
      const divisor = gcd(absBigInt(n), d);
      this.n = n / divisor;
      this.d = d / divisor;
      Object.freeze(this);
    }

    static parse(value) {
      if (value instanceof Fraction) return value;
      if (typeof value === 'bigint') return new Fraction(value);
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('Todos los valores deben ser números finitos.');
        return Fraction.parse(String(value));
      }
      if (typeof value !== 'string') throw new Error('Cada entrada debe ser un número o fracción.');
      const raw = value.trim().replace(',', '.');
      if (!raw) throw new Error('Las entradas no pueden estar vacías.');
      const fractionMatch = raw.match(/^([+-]?)(\d+)\s*\/\s*(\d+)$/);
      if (fractionMatch) {
        const sign = fractionMatch[1] === '-' ? -1n : 1n;
        const numerator = sign * BigInt(fractionMatch[2]);
        const denominator = BigInt(fractionMatch[3]);
        if (denominator === 0n) throw new Error('Una fracción no puede tener denominador cero.');
        return new Fraction(numerator, denominator);
      }
      const decimalMatch = raw.match(/^([+-]?)(?:\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?$/i);
      if (!decimalMatch) throw new Error(`Entrada no válida: "${value}". Usa números o fracciones como 3/4.`);
      const sign = raw.startsWith('-') ? -1n : 1n;
      const unsigned = raw.replace(/^[+-]/, '');
      const mantissa = unsigned.split(/e/i)[0];
      const [wholePart, decimalPart = ''] = mantissa.split('.');
      const whole = wholePart || '0';
      const decimals = decimalPart;
      const exponent = Number(decimalMatch[2] || 0);
      const digits = BigInt((whole + decimals) || '0');
      const decimalPlaces = decimals.length - exponent;
      if (decimalPlaces >= 0) {
        return new Fraction(sign * digits, 10n ** BigInt(decimalPlaces));
      }
      return new Fraction(sign * digits * (10n ** BigInt(-decimalPlaces)), 1n);
    }

    add(other) {
      const b = Fraction.parse(other);
      return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d);
    }

    sub(other) {
      const b = Fraction.parse(other);
      return new Fraction(this.n * b.d - b.n * this.d, this.d * b.d);
    }

    mul(other) {
      const b = Fraction.parse(other);
      return new Fraction(this.n * b.n, this.d * b.d);
    }

    div(other) {
      const b = Fraction.parse(other);
      if (b.n === 0n) throw new Error('División entre cero.');
      return new Fraction(this.n * b.d, this.d * b.n);
    }

    neg() {
      return new Fraction(-this.n, this.d);
    }

    isZero() {
      return this.n === 0n;
    }

    abs() {
      return new Fraction(absBigInt(this.n), this.d);
    }

    compareAbs(other) {
      const b = Fraction.parse(other);
      const left = absBigInt(this.n) * b.d;
      const right = absBigInt(b.n) * this.d;
      return left === right ? 0 : (left > right ? 1 : -1);
    }

    toNumber() {
      return Number(this.n) / Number(this.d);
    }

    toString() {
      return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
    }
  }

  function absBigInt(value) {
    return value < 0n ? -value : value;
  }

  function gcd(a, b) {
    let x = absBigInt(a);
    let y = absBigInt(b);
    while (y !== 0n) {
      const rest = x % y;
      x = y;
      y = rest;
    }
    return x || 1n;
  }

  function cloneMatrix(matrix) {
    return matrix.map(row => row.slice());
  }

  function toFractionMatrix(matrix) {
    return matrix.map(row => row.map(Fraction.parse));
  }

  function rankOf(matrix) {
    if (!matrix.length) return 0;
    const work = toFractionMatrix(matrix);
    const rows = work.length;
    const cols = work[0].length;
    let rank = 0;
    let pivotRow = 0;

    for (let col = 0; col < cols && pivotRow < rows; col += 1) {
      let best = pivotRow;
      for (let r = pivotRow + 1; r < rows; r += 1) {
        if (work[r][col].compareAbs(work[best][col]) > 0) best = r;
      }
      if (work[best][col].isZero()) continue;
      [work[pivotRow], work[best]] = [work[best], work[pivotRow]];
      for (let r = pivotRow + 1; r < rows; r += 1) {
        const factor = work[r][col].div(work[pivotRow][col]);
        if (factor.isZero()) continue;
        for (let c = col; c < cols; c += 1) {
          work[r][c] = work[r][c].sub(factor.mul(work[pivotRow][c]));
        }
      }
      pivotRow += 1;
      rank += 1;
    }
    return rank;
  }

  function validateAugmented(augmented) {
    if (!Array.isArray(augmented) || augmented.length < 1 || augmented.length > 5) {
      throw new Error('La matriz debe tener entre 1 y 5 filas.');
    }
    const width = Array.isArray(augmented[0]) ? augmented[0].length : 0;
    if (width < 2 || width > 6) {
      throw new Error('La matriz debe tener entre 2 y 6 columnas (hasta 5 variables).');
    }
    const normalized = augmented.map(row => {
      if (!Array.isArray(row) || row.length !== width) {
        throw new Error('Todas las filas deben tener el mismo número de columnas.');
      }
      return row.map(value => Fraction.parse(value));
    });
    return { matrix: normalized, variables: width - 1 };
  }

  function cloneForOutput(matrix) {
    return cloneMatrix(matrix);
  }

  function recordStep(steps, label, matrix, focus = {}) {
    steps.push({
      label,
      matrix: cloneForOutput(matrix),
      focus: {
        rows: Array.isArray(focus.rows) ? focus.rows.slice() : [],
        targetRow: Number.isInteger(focus.targetRow) ? focus.targetRow : -1,
        pivot: Array.isArray(focus.pivot) ? focus.pivot.slice() : null
      }
    });
  }

  function verifyUniqueSolution(matrix, solution, variables) {
    const residuals = matrix.map(row => {
      let total = new Fraction(0);
      for (let column = 0; column < variables; column += 1) {
        total = total.add(row[column].mul(solution[column]));
      }
      return total.sub(row[variables]);
    });
    return {
      type: 'unique',
      verified: residuals.every(value => value.isZero()),
      residuals
    };
  }

  function verifyParametricSolution(matrix, parametricSolution, variables) {
    const parameterNames = parametricSolution.parameters.map(parameter => parameter.name);
    const residuals = matrix.map(row => {
      const constant = row
        .slice(0, variables)
        .reduce(
          (total, coefficient, column) => total.add(coefficient.mul(parametricSolution.expressions[column].constant)),
          new Fraction(0)
        )
        .sub(row[variables]);

      const parameterCoefficients = Object.fromEntries(
        parameterNames.map(name => [name, new Fraction(0)])
      );

      for (let column = 0; column < variables; column += 1) {
        const coefficient = row[column];
        for (const term of parametricSolution.expressions[column].terms) {
          parameterCoefficients[term.parameter] = parameterCoefficients[term.parameter]
            .add(coefficient.mul(term.coefficient));
        }
      }

      return {
        constant,
        parameters: parameterNames.map(name => ({
          name,
          coefficient: parameterCoefficients[name]
        }))
      };
    });

    const verified = residuals.every(residual =>
      residual.constant.isZero() &&
      residual.parameters.every(item => item.coefficient.isZero())
    );

    return {
      type: 'infinite',
      verified,
      parameters: parameterNames,
      residuals
    };
  }

  function findContradiction(matrix, variables) {
    for (let row = 0; row < matrix.length; row += 1) {
      const allCoefficientsZero = matrix[row]
        .slice(0, variables)
        .every(value => value.isZero());
      const constant = matrix[row][variables];
      if (allCoefficientsZero && !constant.isZero()) {
        return {
          row,
          value: constant,
          equation: `0 = ${constant.toString()}`
        };
      }
    }
    return null;
  }

  function classify(echelonOrReduced, variables) {
    for (const row of echelonOrReduced) {
      const allCoefficientsZero = row.slice(0, variables).every(value => value.isZero());
      const rhsNonZero = !row[variables].isZero();
      if (allCoefficientsZero && rhsNonZero) return 'none';
    }
    return rankOf(echelonOrReduced.map(row => row.slice(0, variables))) === variables
      ? 'unique'
      : 'infinite';
  }

  function findPivots(reduced, variables) {
    const pivotForColumn = Array(variables).fill(-1);
    for (let r = 0; r < reduced.length; r += 1) {
      const pivot = reduced[r].slice(0, variables).findIndex(value => !value.isZero());
      if (pivot !== -1 && pivotForColumn[pivot] === -1) pivotForColumn[pivot] = r;
    }
    return pivotForColumn;
  }

  function extractSolution(reduced, variables) {
    const solution = Array(variables).fill(null).map(() => new Fraction(0));
    const pivots = findPivots(reduced, variables);
    for (let column = 0; column < variables; column += 1) {
      if (pivots[column] !== -1) {
        solution[column] = reduced[pivots[column]][variables];
      }
    }
    return solution;
  }

  function buildParametricSolution(reduced, variables) {
    const pivotForColumn = findPivots(reduced, variables);
    const freeColumns = [];
    for (let c = 0; c < variables; c += 1) {
      if (pivotForColumn[c] === -1) freeColumns.push(c);
    }

    const parameters = freeColumns.map((column, index) => ({
      column,
      name: `t${index + 1}`
    }));

    const expressions = Array.from({ length: variables }, (_, column) => {
      const pivotRow = pivotForColumn[column];
      if (pivotRow === -1) {
        const parameter = parameters.find(item => item.column === column);
        return {
          variable: column,
          constant: new Fraction(0),
          terms: [{ parameter: parameter.name, coefficient: new Fraction(1) }],
          text: parameter.name
        };
      }

      const row = reduced[pivotRow];
      const terms = freeColumns
        .map((freeColumn, index) => ({
          parameter: parameters[index].name,
          coefficient: row[freeColumn].neg()
        }))
        .filter(term => !term.coefficient.isZero());

      const constant = row[variables];
      return {
        variable: column,
        constant,
        terms,
        text: formatExpressionValue(constant, terms)
      };
    });

    return { parameters, expressions };
  }

  function formatExpressionValue(constant, terms) {
    let text = constant.toString();
    for (const term of terms) {
      const coefficient = term.coefficient;
      const negative = coefficient.n < 0n;
      const absolute = negative ? coefficient.neg() : coefficient;
      const coefficientText = absolute.toString() === '1' ? '' : absolute.toString();
      const signed = negative ? ' − ' : ' + ';
      text += `${signed}${coefficientText}${term.parameter}`;
    }
    if (text === '0') return '0';
    return text;
  }

  function gaussJordan(augmented) {
    const { matrix, variables } = validateAugmented(augmented);
    const rows = matrix.length;
    const cols = matrix[0].length;
    const work = cloneMatrix(matrix);
    const steps = [];
    let pivotRow = 0;

    recordStep(steps, 'Matriz inicial', work);

    for (let col = 0; col < variables && pivotRow < rows; col += 1) {
      let bestRow = pivotRow;
      for (let r = pivotRow + 1; r < rows; r += 1) {
        if (work[r][col].compareAbs(work[bestRow][col]) > 0) bestRow = r;
      }
      if (work[bestRow][col].isZero()) continue;

      if (bestRow !== pivotRow) {
        [work[pivotRow], work[bestRow]] = [work[bestRow], work[pivotRow]];
        recordStep(steps, `Intercambio F${pivotRow + 1} ↔ F${bestRow + 1}`, work, {
          rows: [pivotRow, bestRow],
          pivot: [pivotRow, col]
        });
      }

      const pivot = work[pivotRow][col];
      if (pivot.toString() !== '1') {
        for (let c = 0; c < cols; c += 1) work[pivotRow][c] = work[pivotRow][c].div(pivot);
        recordStep(steps, `F${pivotRow + 1} ← F${pivotRow + 1} ÷ ${pivot}`, work, {
          rows: [pivotRow],
          targetRow: pivotRow,
          pivot: [pivotRow, col]
        });
      }

      for (let r = 0; r < rows; r += 1) {
        if (r === pivotRow) continue;
        const factor = work[r][col];
        if (factor.isZero()) continue;
        for (let c = 0; c < cols; c += 1) {
          work[r][c] = work[r][c].sub(factor.mul(work[pivotRow][c]));
        }
        recordStep(steps, `F${r + 1} ← F${r + 1} ${formatSignedFactor(factor.neg())}·F${pivotRow + 1}`, work, {
          rows: [r, pivotRow],
          targetRow: r,
          pivot: [pivotRow, col]
        });
      }
      pivotRow += 1;
    }

    const classification = classify(work, variables);
    const rankA = rankOf(matrix.map(row => row.slice(0, variables)));
    const rankAugmented = rankOf(matrix);
    const contradiction = findContradiction(work, variables);
    const solution = classification === 'unique' ? extractSolution(work, variables) : null;
    const parametricSolution = classification === 'infinite' ? buildParametricSolution(work, variables) : null;
    const verification = classification === 'unique'
      ? verifyUniqueSolution(matrix, solution, variables)
      : classification === 'infinite'
        ? verifyParametricSolution(matrix, parametricSolution, variables)
        : {
            type: 'none',
            verified: null,
            residuals: []
          };

    return {
      method: 'Gauss-Jordan',
      matrixType: 'Matriz reducida (RREF)',
      matrix: work,
      steps,
      variables,
      classification,
      rankA,
      rankAugmented,
      contradiction,
      verification,
      solution,
      parametricSolution
    };
  }

  function gaussian(augmented) {
    const { matrix, variables } = validateAugmented(augmented);
    const rows = matrix.length;
    const cols = matrix[0].length;
    const work = cloneMatrix(matrix);
    const steps = [];
    let pivotRow = 0;

    recordStep(steps, 'Matriz inicial', work);

    for (let col = 0; col < variables && pivotRow < rows; col += 1) {
      let bestRow = pivotRow;
      for (let r = pivotRow + 1; r < rows; r += 1) {
        if (work[r][col].compareAbs(work[bestRow][col]) > 0) bestRow = r;
      }
      if (work[bestRow][col].isZero()) continue;

      if (bestRow !== pivotRow) {
        [work[pivotRow], work[bestRow]] = [work[bestRow], work[pivotRow]];
        recordStep(steps, `Intercambio F${pivotRow + 1} ↔ F${bestRow + 1}`, work, {
          rows: [pivotRow, bestRow],
          pivot: [pivotRow, col]
        });
      }

      const pivot = work[pivotRow][col];
      for (let r = pivotRow + 1; r < rows; r += 1) {
        const factor = work[r][col].div(pivot);
        if (factor.isZero()) continue;
        for (let c = col; c < cols; c += 1) {
          work[r][c] = work[r][c].sub(factor.mul(work[pivotRow][c]));
        }
        recordStep(steps, `F${r + 1} ← F${r + 1} ${formatSignedFactor(factor.neg())}·F${pivotRow + 1}`, work, {
          rows: [r, pivotRow],
          targetRow: r,
          pivot: [pivotRow, col]
        });
      }
      pivotRow += 1;
    }

    const classification = classify(work, variables);
    const rankA = rankOf(matrix.map(row => row.slice(0, variables)));
    const rankAugmented = rankOf(matrix);
    const contradiction = findContradiction(work, variables);
    let solution = null;
    let parametricSolution = null;

    if (classification === 'unique') {
      const reducedResult = gaussJordan(augmented);
      solution = reducedResult.solution;
    } else if (classification === 'infinite') {
      const reducedResult = gaussJordan(augmented);
      parametricSolution = reducedResult.parametricSolution;
    }

    const verification = classification === 'unique'
      ? verifyUniqueSolution(matrix, solution, variables)
      : classification === 'infinite'
        ? verifyParametricSolution(matrix, parametricSolution, variables)
        : {
            type: 'none',
            verified: null,
            residuals: []
          };

    return {
      method: 'Eliminación de Gauss',
      matrixType: 'Matriz escalonada',
      matrix: work,
      steps,
      variables,
      classification,
      rankA,
      rankAugmented,
      contradiction,
      verification,
      solution,
      parametricSolution
    };
  }

  function solve(augmented, method = 'gauss-jordan') {
    return method === 'gaussian' ? gaussian(augmented) : gaussJordan(augmented);
  }

  function formatNumber(value) {
    return Fraction.parse(value).toString();
  }

  function formatDecimal(value) {
    const number = Fraction.parse(value).toNumber();
    if (!Number.isFinite(number)) return 'valor decimal no disponible';
    const rounded = Number(number.toFixed(6));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  function formatSignedFactor(value) {
    const fraction = Fraction.parse(value);
    const absolute = fraction.n < 0n ? fraction.neg() : fraction;
    return fraction.n < 0n ? `- ${absolute}` : `+ ${absolute}`;
  }

  return {
    EPSILON,
    Fraction,
    solve,
    gaussJordan,
    gaussian,
    rankOf,
    formatNumber,
    formatDecimal
  };
});
