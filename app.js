(() => {
  'use strict';

  const equationsSelect = document.getElementById('equationsSelect');
  const variablesSelect = document.getElementById('variablesSelect');
  const methodSelect = document.getElementById('methodSelect');
  const matrixContainer = document.getElementById('matrixContainer');
  const matrixSizeLabel = document.getElementById('matrixSizeLabel');
  const solveBtn = document.getElementById('solveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const inputError = document.getElementById('inputError');
  const resultSection = document.getElementById('resultSection');
  const resultBadge = document.getElementById('resultBadge');
  const resultSummary = document.getElementById('resultSummary');
  const equationsPreview = document.getElementById('equationsPreview');
  const solutionContainer = document.getElementById('solutionContainer');
  const reducedMatrixContainer = document.getElementById('reducedMatrixContainer');
  const stepsContainer = document.getElementById('stepsContainer');
  const toggleStepsBtn = document.getElementById('toggleStepsBtn');
  const stepPrevBtn = document.getElementById('stepPrevBtn');
  const stepNextBtn = document.getElementById('stepNextBtn');
  const stepCounter = document.getElementById('stepCounter');
  const rankLabel = document.getElementById('rankLabel');
  const methodLabel = document.getElementById('methodLabel');
  const explanationPanel = document.getElementById('explanationPanel');
  const contradictionPanel = document.getElementById('contradictionPanel');
  const verificationPanel = document.getElementById('verificationPanel');
  const stepsHint = document.getElementById('stepsHint');
  const historyContainer = document.getElementById('historyContainer');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const presetButtons = [...document.querySelectorAll('[data-example]')];
  const copyResultBtn = document.getElementById('copyResultBtn');
  const downloadReportBtn = document.getElementById('downloadReportBtn');
  const printResultBtn = document.getElementById('printResultBtn');
  const exportStatus = document.getElementById('exportStatus');
  const HISTORY_KEY = 'matrix-solver-history-v1';
  const MAX_HISTORY = 8;
  let lastResult = null;
  let lastMatrix = null;
  let currentStepIndex = 0;
  let currentSteps = [];

  const examples = {
    unique: { equations: 2, variables: 2, matrix: [['2', '1', '5'], ['1', '-1', '1']] },
    fraction: { equations: 2, variables: 2, matrix: [['1', '0', '1/3'], ['0', '2', '1/2']] },
    infinite: { equations: 2, variables: 2, matrix: [['1', '1', '2'], ['2', '2', '4']] },
    none: { equations: 2, variables: 2, matrix: [['1', '1', '2'], ['2', '2', '5']] },
    five: {
      equations: 5,
      variables: 5,
      matrix: [
        ['1', '0', '0', '0', '0', '3'],
        ['0', '1', '0', '0', '0', '-2'],
        ['0', '0', '1', '0', '0', '5'],
        ['0', '0', '0', '1', '0', '7'],
        ['0', '0', '0', '0', '1', '-1']
      ]
    }
  };

  const VARIABLE_NAMES = ['x', 'y', 'z', 'w', 'v'];

  function variableName(index) {
    return VARIABLE_NAMES[index] || `x${index + 1}`;
  }

  function populateSelect(select, label) {
    select.innerHTML = '';
    for (let n = 1; n <= 5; n += 1) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = `${n} ${label}${n === 1 ? '' : 's'}`;
      select.appendChild(option);
    }
  }

  function buildMatrix(values) {
    const rows = Number(equationsSelect.value);
    const variables = Number(variablesSelect.value);
    matrixContainer.innerHTML = '';
    matrixSizeLabel.textContent = `${rows}×${variables + 1}`;

    for (let r = 0; r < rows; r += 1) {
      const row = document.createElement('div');
      row.className = 'matrix-row';
      for (let c = 0; c <= variables; c += 1) {
        const input = document.createElement('input');
        input.className = `matrix-cell${c === variables ? ' constant' : ''}`;
        input.type = 'text';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.placeholder = '0 · 1/2';
        input.setAttribute('aria-label', c === variables
          ? `Ecuación ${r + 1}, término independiente`
          : `Ecuación ${r + 1}, variable ${variableName(c)}`);
        input.value = values?.[r]?.[c] ?? '';
        row.appendChild(input);
      }
      matrixContainer.appendChild(row);
    }
  }

  function getMatrixFromInputs() {
    return [...matrixContainer.querySelectorAll('.matrix-row')].map(row =>
      [...row.querySelectorAll('input')].map(input => input.value.trim())
    );
  }

  function resetResults() {
    resultSection.hidden = true;
    inputError.hidden = true;
    inputError.textContent = '';
    stepsContainer.hidden = true;
    stepsHint.hidden = true;
    toggleStepsBtn.textContent = 'Mostrar pasos';
    toggleStepsBtn.setAttribute('aria-expanded', 'false');
    currentSteps = [];
    currentStepIndex = 0;
    contradictionPanel.hidden = true;
    contradictionPanel.innerHTML = '';
    verificationPanel.hidden = true;
    verificationPanel.innerHTML = '';
    updateStepNavigation();
  }

  function clearAll() {
    buildMatrix();
    resetResults();
  }

  function showError(message) {
    inputError.textContent = message;
    inputError.hidden = false;
    resultSection.hidden = true;
  }

  function statusText(classification) {
    if (classification === 'unique') return 'Solución única';
    if (classification === 'infinite') return 'Infinitas soluciones';
    return 'Sin solución';
  }

  function renderMatrix(matrix, focus = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'output-grid';
    const variables = matrix[0].length - 1;
    const focusRows = focus?.rows || [];
    const pivot = focus?.pivot || null;
    matrix.forEach((row, rowIndex) => {
      const outRow = document.createElement('div');
      const classes = ['output-row'];
      if (focusRows.includes(rowIndex)) classes.push('step-focus-row');
      if (focus?.targetRow === rowIndex) classes.push('step-target-row');
      outRow.className = classes.join(' ');

      row.forEach((value, index) => {
        const cell = document.createElement('div');
        const cellClasses = ['output-cell'];
        if (index === variables) cellClasses.push('constant');
        if (pivot?.[0] === rowIndex && pivot?.[1] === index) cellClasses.push('pivot-cell');
        cell.className = cellClasses.join(' ');
        cell.textContent = MatrixSolver.formatNumber(value);
        outRow.appendChild(cell);
      });
      wrapper.appendChild(outRow);
    });
    return wrapper;
  }

  function renderSolution(result) {
    solutionContainer.innerHTML = '';

    if (result.classification === 'unique') {
      const list = document.createElement('div');
      list.className = 'solution-list';
      result.solution.forEach((value, index) => {
        const row = document.createElement('div');
        row.className = 'solution-row';
        const exact = MatrixSolver.formatNumber(value);
        const decimal = MatrixSolver.formatDecimal(value);
        const display = exact.includes('/') ? `${exact} ≈ ${decimal}` : exact;
        row.innerHTML = `<strong>${variableName(index)}</strong><span>${display}</span>`;
        list.appendChild(row);
      });
      solutionContainer.appendChild(list);
      return;
    }

    if (result.classification === 'infinite') {
      const wrap = document.createElement('div');
      wrap.className = 'parametric-solution';
      const intro = document.createElement('p');
      intro.className = 'empty-note';
      intro.textContent = result.parametricSolution.parameters.length === 1
        ? 'La variable libre se representa con un parámetro.'
        : 'Las variables libres se representan con parámetros.';
      wrap.appendChild(intro);

      const parameterRow = document.createElement('div');
      parameterRow.className = 'parameter-box';
      parameterRow.innerHTML = `<strong>Libres:</strong> ${result.parametricSolution.parameters.map(item => `<span>${variableName(item.column)} = ${item.name}</span>`).join(' · ')}`;
      wrap.appendChild(parameterRow);

      const list = document.createElement('div');
      list.className = 'solution-list';
      result.parametricSolution.expressions.forEach(expression => {
        const row = document.createElement('div');
        row.className = 'solution-row';
        row.innerHTML = `<strong>${variableName(expression.variable)}</strong><span class="expression">${expression.text}</span>`;
        list.appendChild(row);
      });
      wrap.appendChild(list);
      solutionContainer.appendChild(wrap);
      return;
    }

    solutionContainer.innerHTML = '<p class="empty-note">Las ecuaciones son incompatibles. No existe ningún conjunto de valores que satisfaga todo el sistema.</p>';
  }

  function signedEquationTerm(coefficient, variable, isFirst) {
    const value = MatrixSolver.formatNumber(coefficient);
    const negative = value.startsWith('-');
    const absolute = negative ? value.slice(1) : value;
    const coefficientText = absolute === '1' ? '' : absolute;
    const body = coefficientText + variable;

    if (isFirst) return negative ? `− ${body}` : body;
    return negative ? ` − ${body}` : ` + ${body}`;
  }

  function renderEquations(matrix) {
    equationsPreview.innerHTML = '';
    const heading = document.createElement('div');
    heading.className = 'panel-heading';
    const title = document.createElement('h3');
    title.textContent = 'Sistema de ecuaciones';
    const note = document.createElement('span');
    note.className = 'mini-label';
    note.textContent = `${matrix.length} ecuaciones`;
    heading.append(title, note);

    const list = document.createElement('div');
    list.className = 'equations-list';

    matrix.forEach((row, rowIndex) => {
      const equation = document.createElement('div');
      equation.className = 'equation-row';

      let text = '';
      let hasTerm = false;
      for (let column = 0; column < row.length - 1; column += 1) {
        const coefficient = row[column];
        if (MatrixSolver.formatNumber(coefficient) === '0') continue;
        text += signedEquationTerm(coefficient, variableName(column), !hasTerm);
        hasTerm = true;
      }

      if (!hasTerm) text = '0';
      text += ` = ${MatrixSolver.formatNumber(row[row.length - 1])}`;

      equation.textContent = `E${rowIndex + 1}: ${text}`;
      list.appendChild(equation);
    });

    equationsPreview.append(heading, list);
  }

  function updateStepNavigation() {
    const total = currentSteps.length;
    stepCounter.textContent = `Paso ${total ? currentStepIndex + 1 : 0} de ${total}`;
    stepPrevBtn.disabled = total === 0 || currentStepIndex === 0;
    stepNextBtn.disabled = total === 0 || currentStepIndex === total - 1;
    stepPrevBtn.hidden = total <= 1;
    stepNextBtn.hidden = total <= 1;
    stepCounter.hidden = total <= 1;
  }

  function showStep(index) {
    if (!currentSteps.length) {
      updateStepNavigation();
      return;
    }

    currentStepIndex = Math.max(0, Math.min(index, currentSteps.length - 1));
    [...stepsContainer.querySelectorAll('.step')].forEach((card, cardIndex) => {
      card.classList.toggle('active', cardIndex === currentStepIndex);
      card.setAttribute('aria-hidden', String(cardIndex !== currentStepIndex));
    });
    updateStepNavigation();
  }

  function classificationExplanation(result) {
    if (result.classification === 'unique') {
      return {
        title: '¿Por qué hay una solución única?',
        body: `El rango de la matriz de coeficientes coincide con el número de variables (${result.rankA} = ${result.variables}) y también coincide con el rango de la matriz aumentada (${result.rankA} = ${result.rankAugmented}). Por eso cada variable queda determinada por el sistema.`,
        className: 'explanation unique'
      };
    }

    if (result.classification === 'infinite') {
      const free = result.parametricSolution.parameters.map(item => variableName(item.column)).join(', ');
      return {
        title: '¿Por qué hay infinitas soluciones?',
        body: `El rango de los coeficientes y de la matriz aumentada coincide (${result.rankA} = ${result.rankAugmented}), así que el sistema es compatible. Pero el rango es menor que el número de variables (${result.rankA} < ${result.variables}), por lo que existen variables libres (${free}) y aparecen infinitas soluciones.`,
        className: 'explanation infinite'
      };
    }

    const contradiction = result.contradiction;
    const contradictionText = contradiction
      ? `En la fila F${contradiction.row + 1} aparece exactamente ${contradiction.equation}.`
      : 'Al reducir la matriz aparece una contradicción del tipo 0 = c, con c distinto de cero.';
    return {
      title: '¿Por qué no hay solución?',
      body: `Los rangos son diferentes: r(A) = ${result.rankA} y r(A|b) = ${result.rankAugmented}. ${contradictionText} Por tanto, ninguna asignación de variables puede satisfacer simultáneamente todas las ecuaciones.`,
      className: 'explanation none'
    };
  }

  function stepFocusText(focus) {
    if (!focus || !focus.rows?.length) return '';
    if (focus.targetRow >= 0) {
      return focus.rows.length > 1
        ? `Filas implicadas: F${focus.rows.map(row => row + 1).join(' y F')}. F${focus.targetRow + 1} es la fila objetivo; el pivote está resaltado.`
        : `Fila implicada: F${focus.targetRow + 1}. El pivote está resaltado.`;
    }
    return `Filas implicadas: F${focus.rows.map(row => row + 1).join(' y F')}.`;
  }

  function renderVerification(result) {
    verificationPanel.innerHTML = '';

    if (result.verification?.type === 'none') {
      verificationPanel.hidden = false;
      verificationPanel.className = 'verification-panel neutral';
      verificationPanel.innerHTML = '<strong>Verificación del resultado</strong><p>No existe una solución que sustituir. La validez del resultado se confirma mediante la contradicción detectada arriba.</p>';
      return;
    }

    const verified = result.verification?.verified === true;
    verificationPanel.hidden = false;
    verificationPanel.className = `verification-panel ${verified ? 'verified' : 'failed'}`;

    const title = document.createElement('strong');
    title.textContent = verified
      ? '✅ Verificación por sustitución correcta'
      : '⚠️ La sustitución no coincide';

    const note = document.createElement('p');
    note.textContent = result.verification.type === 'infinite'
      ? 'Se verificó simbólicamente toda la familia paramétrica: el término constante y el coeficiente de cada parámetro quedan en 0 en todas las ecuaciones.'
      : 'Se sustituyó la solución obtenida en cada ecuación original y todos los residuos quedaron en 0.';

    const list = document.createElement('div');
    list.className = 'verification-list';

    result.verification.residuals.forEach((residual, index) => {
      const row = document.createElement('div');
      row.className = 'verification-row';
      const label = document.createElement('span');
      label.textContent = `E${index + 1}`;
      const value = document.createElement('strong');

      if (result.verification.type === 'infinite') {
        const terms = residual.parameters
          .filter(item => !item.coefficient.isZero())
          .map(item => `${item.coefficient.toString()}${item.name}`);
        value.textContent = [residual.constant.toString(), ...terms].join(' + ') || '0';
      } else {
        value.textContent = MatrixSolver.formatNumber(residual);
      }

      row.append(label, value);
      list.appendChild(row);
    });

    verificationPanel.append(title, note, list);
  }

  function renderContradiction(result) {
    contradictionPanel.innerHTML = '';
    if (!result.contradiction) {
      contradictionPanel.hidden = true;
      return;
    }

    const title = document.createElement('strong');
    title.textContent = 'Contradicción encontrada';

    const equation = document.createElement('div');
    equation.className = 'contradiction-equation';
    equation.textContent = `F${result.contradiction.row + 1}: ${result.contradiction.equation}`;

    const note = document.createElement('p');
    note.textContent = 'Todas las variables quedaron con coeficiente 0, pero el término independiente no es 0. Esa fila representa una igualdad imposible y confirma que el sistema no tiene solución.';

    contradictionPanel.append(title, equation, note);
    contradictionPanel.hidden = false;
  }

  function stepExplanation(label) {
    if (label === 'Matriz inicial') {
      return 'Se parte de la matriz aumentada que representa todas las ecuaciones del sistema.';
    }
    if (label.startsWith('Intercambio')) {
      return 'Se intercambian dos filas para colocar un pivote útil en la posición actual. Esta operación no cambia las soluciones del sistema.';
    }
    if (label.includes('÷')) {
      return 'Se divide toda la fila por el pivote para convertirlo en 1 y facilitar la eliminación.';
    }
    if (label.includes('·F')) {
      return 'Se combina la fila actual con la fila pivote para eliminar el coeficiente de la variable que se está trabajando. Es una operación elemental que conserva las soluciones.';
    }
    return 'Se aplica una operación elemental de filas que conserva el conjunto de soluciones.';
  }

  function renderSteps(steps) {
    stepsContainer.innerHTML = '';
    currentSteps = steps;
    currentStepIndex = 0;
    const list = document.createElement('div');
    list.className = 'steps-list';
    steps.forEach((step, index) => {
      const card = document.createElement('div');
      card.className = 'step';
      const title = document.createElement('div');
      title.className = 'step-title';
      title.textContent = `${index + 1}. ${step.label}`;
      card.appendChild(title);

      const explanation = document.createElement('div');
      explanation.className = 'step-explanation';
      explanation.textContent = stepExplanation(step.label);
      card.appendChild(explanation);

      const focusText = stepFocusText(step.focus);
      if (focusText) {
        const focus = document.createElement('div');
        focus.className = 'step-focus-text';
        focus.textContent = focusText;
        card.appendChild(focus);
      }

      card.appendChild(renderMatrix(step.matrix, step.focus));
      list.appendChild(card);
    });
    stepsContainer.appendChild(list);
    showStep(0);
  }

  function solutionText(result) {
    if (result.classification === 'unique') {
      return result.solution
        .map((value, index) => `${variableName(index)} = ${MatrixSolver.formatNumber(value)}`)
        .join('\
');
    }

    if (result.classification === 'infinite') {
      return result.parametricSolution.expressions
        .map(expression => `${variableName(expression.variable)} = ${expression.text}`)
        .join('\
');
    }

    return 'El sistema no tiene solución.';
  }

  function matrixText(matrix) {
    return matrix.map(row => row.map(value => MatrixSolver.formatNumber(value)).join('   |   ')).join('\
');
  }

  function formatEquationsForReport(matrix) {
    return matrix.map(row => {
      let text = '';
      let hasTerm = false;
      for (let column = 0; column < row.length - 1; column += 1) {
        const coefficient = MatrixSolver.formatNumber(row[column]);
        if (coefficient === '0') continue;
        const negative = coefficient.startsWith('-');
        const absolute = negative ? coefficient.slice(1) : coefficient;
        const coefficientText = absolute === '1' ? '' : absolute;
        const body = coefficientText + variableName(column);
        if (!hasTerm) text += negative ? `− ${body}` : body;
        else text += negative ? ` − ${body}` : ` + ${body}`;
        hasTerm = true;
      }
      if (!hasTerm) text = '0';
      return text + ` = ${MatrixSolver.formatNumber(row[row.length - 1])}`;
    });
  }

  function buildReport() {
    if (!lastResult || !lastMatrix) return '';
    const method = lastResult.method;
    const type = lastResult.matrixType;
    const status = statusText(lastResult.classification);
    const lines = [
      'MATRIX SOLVER',
      '==============================',
      `Método: ${method}`,
      `Estado: ${status}`,
      `Rango A: ${lastResult.rankA}`,
      `Rango (A|b): ${lastResult.rankAugmented}`,
      '',
      'SISTEMA DE ECUACIONES',
      '------------------------------',
      ...formatEquationsForReport(lastMatrix),
      '',
      'MATRIZ DE ENTRADA',
      '------------------------------',
      matrixText(lastMatrix),
      '',
      'SOLUCIÓN',
      '------------------------------',
      solutionText(lastResult),
      '',
      ...(lastResult.contradiction
        ? ['CONTRADICCIÓN', '------------------------------', `Fila F${lastResult.contradiction.row + 1}: ${lastResult.contradiction.equation}`, '']
        : []),
      'VERIFICACIÓN',
      '------------------------------',
      lastResult.verification?.type === 'none'
        ? 'No hay solución que sustituir; el resultado se confirma mediante la contradicción.'
        : `Verificada: ${lastResult.verification?.verified ? 'sí' : 'no'}`,
      ...(lastResult.verification?.type === 'infinite'
        ? lastResult.verification.residuals.map((residual, index) =>
            `E${index + 1}: constante=${residual.constant.toString()}, parámetros=${residual.parameters.map(item => `${item.name}:${item.coefficient.toString()}`).join(', ')}`)
        : lastResult.verification?.type === 'unique'
          ? lastResult.verification.residuals.map((residual, index) => `E${index + 1}: residuo=${residual.toString()}`)
          : []),
      '',
      type.toUpperCase(),
      '------------------------------',
      matrixText(lastResult.matrix),
      '',
      'PROCEDIMIENTO',
      '------------------------------'
    ];

    lastResult.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.label}`);
      lines.push(matrixText(step.matrix));
      lines.push('');
    });

    lines.push('Generado por Matrix Solver.');
    return lines.join('\
');
  }

  function notifyExport(message, isError = false) {
    exportStatus.textContent = message;
    exportStatus.className = `export-status${isError ? ' error' : ''}`;
    exportStatus.hidden = false;
    window.clearTimeout(notifyExport.timer);
    notifyExport.timer = window.setTimeout(() => {
      exportStatus.hidden = true;
    }, 3000);
  }

  async function copyResult() {
    if (!lastResult) return;
    const text = solutionText(lastResult);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      notifyExport('✅ Solución copiada al portapapeles.');
    } catch (error) {
      notifyExport('No se pudo copiar automáticamente. Selecciona y copia el resultado manualmente.', true);
    }
  }

  function downloadReport() {
    if (!lastResult || !lastMatrix) return;
    try {
      const blob = new Blob([buildReport()], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'matrix-solver-reporte.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notifyExport('✅ Reporte descargado.');
    } catch (error) {
      notifyExport('No se pudo generar el reporte.', true);
    }
  }

  function printResult() {
    if (!lastResult) return;
    notifyExport('Se abrió el diálogo de impresión. Puedes elegir “Guardar como PDF”.');
    window.print();
  }

  function saveToHistory(matrix, result, method) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      matrix: matrix.map(row => row.slice()),
      equations: matrix.length,
      variables: matrix[0].length - 1,
      method,
      classification: result.classification,
      createdAt: new Date().toISOString()
    };
    try {
      const current = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const safeCurrent = Array.isArray(current) ? current : [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...safeCurrent].slice(0, MAX_HISTORY)));
    } catch (error) {}
    renderHistory();
  }

  function renderHistory() {
    historyContainer.innerHTML = '';
    let items = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      items = [];
    }

    if (!items.length) {
      historyContainer.innerHTML = '<p class="empty-note">Todavía no hay sistemas guardados.</p>';
      return;
    }

    items.forEach(entry => {
      const item = document.createElement('article');
      item.className = 'history-item';

      const info = document.createElement('div');
      info.className = 'history-info';
      const title = document.createElement('strong');
      title.textContent = `${entry.equations} ecuaciones · ${entry.variables} variables`;
      const meta = document.createElement('span');
      meta.textContent = `${statusText(entry.classification)} · ${entry.method === 'gaussian' ? 'Gauss' : 'Gauss-Jordan'} · ${formatHistoryDate(entry.createdAt)}`;
      info.append(title, meta);

      const badge = document.createElement('span');
      badge.className = `history-status ${entry.classification}`;
      badge.textContent = statusText(entry.classification);

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'text-btn';
      load.textContent = 'Cargar';
      load.addEventListener('click', () => loadHistoryEntry(entry));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'history-delete';
      remove.setAttribute('aria-label', 'Eliminar sistema del historial');
      remove.textContent = '×';
      remove.addEventListener('click', () => deleteHistoryEntry(entry.id));

      actions.append(load, remove);
      item.append(info, badge, actions);
      historyContainer.appendChild(item);
    });
  }

  function formatHistoryDate(value) {
    try {
      return new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    } catch (error) {
      return 'fecha no disponible';
    }
  }

  function loadHistoryEntry(entry) {
    equationsSelect.value = String(entry.equations);
    variablesSelect.value = String(entry.variables);
    methodSelect.value = entry.method;
    buildMatrix(entry.matrix);
    resetResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteHistoryEntry(id) {
    try {
      const current = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const updated = Array.isArray(current) ? current.filter(entry => entry.id !== id) : [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {}
    renderHistory();
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {}
    renderHistory();
  }

  function loadExample(name) {
    const example = examples[name];
    if (!example) return;
    equationsSelect.value = String(example.equations);
    variablesSelect.value = String(example.variables);
    buildMatrix(example.matrix);
    resetResults();
  }

  function renderResult(result) {
    resultSection.hidden = false;
    resultBadge.className = `result-badge ${result.classification}`;
    resultBadge.textContent = statusText(result.classification);

    resultSummary.textContent = result.classification === 'unique'
      ? `El sistema tiene una solución única. Los resultados se muestran como fracciones exactas cuando es necesario.`
      : result.classification === 'infinite'
        ? 'El sistema tiene infinitas soluciones. Se muestran en forma paramétrica y con fracciones exactas.'
        : `El sistema no tiene solución porque la matriz de coeficientes y la aumentada tienen rangos distintos (${result.rankA} y ${result.rankAugmented}).`;

    renderEquations(lastMatrix);
    renderContradiction(result);
    renderVerification(result);
    const explanation = classificationExplanation(result);
    explanationPanel.className = explanation.className;
    explanationPanel.innerHTML = `<strong>${explanation.title}</strong><p>${explanation.body}</p>`;

    renderSolution(result);
    reducedMatrixContainer.innerHTML = '';
    reducedMatrixContainer.appendChild(renderMatrix(result.matrix));
    rankLabel.textContent = `r(A) = ${result.rankA} · r(A|b) = ${result.rankAugmented}`;
    methodLabel.textContent = result.matrixType;
    renderSteps(result.steps);
  }

  function solveSystem() {
    resetResults();
    const matrix = getMatrixFromInputs();
    try {
      const result = MatrixSolver.solve(matrix, methodSelect.value);
      lastMatrix = matrix.map(row => row.slice());
      lastResult = result;
      renderResult(result);
      saveToHistory(matrix, result, methodSelect.value);
    } catch (error) {
      lastResult = null;
      lastMatrix = null;
      showError(error.message || 'No se pudo resolver el sistema.');
    }
  }

  populateSelect(equationsSelect, 'ecuación');
  populateSelect(variablesSelect, 'variable');
  equationsSelect.value = '2';
  variablesSelect.value = '2';
  buildMatrix();
  renderHistory();

  equationsSelect.addEventListener('change', () => { buildMatrix(); resetResults(); });
  variablesSelect.addEventListener('change', () => { buildMatrix(); resetResults(); });
  solveBtn.addEventListener('click', solveSystem);
  clearBtn.addEventListener('click', clearAll);
  clearHistoryBtn.addEventListener('click', clearHistory);
  copyResultBtn.addEventListener('click', copyResult);
  downloadReportBtn.addEventListener('click', downloadReport);
  printResultBtn.addEventListener('click', printResult);
  presetButtons.forEach(button => {
    button.addEventListener('click', () => loadExample(button.dataset.example));
  });

  stepPrevBtn.addEventListener('click', () => showStep(currentStepIndex - 1));
  stepNextBtn.addEventListener('click', () => showStep(currentStepIndex + 1));

  toggleStepsBtn.addEventListener('click', () => {
    const isHidden = stepsContainer.hidden;
    stepsContainer.hidden = !isHidden;
    stepsHint.hidden = !isHidden;
    toggleStepsBtn.textContent = isHidden ? 'Ocultar pasos' : 'Mostrar pasos';
    toggleStepsBtn.setAttribute('aria-expanded', String(isHidden));
  });
})();
