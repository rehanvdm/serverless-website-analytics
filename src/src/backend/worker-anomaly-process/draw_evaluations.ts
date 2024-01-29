import {Evaluation} from "@backend/cron-anomaly-detection/stat_functions";



// export function drawEvaluations(evaluations: Evaluation[]) {
//   evaluations.reverse();
//   const predicted = evaluations.map(e => e.breachingThreshold);
//   const actual = evaluations.map(e => e.value);
//   const xValues = evaluations.map(e => new Date(e.date)); //TODO make sure it is in TZ user specifies, testing is SAST so +02 UTC
//
// // Email does not have equal width characters, so we need tom minimize the ones we use
// // const actualSymbols = [
// //   '─', // 0
// //   '╰', // 1
// //   '╭', // 2
// //   '╮', // 3
// //   '╯', // 4
// //   '│', // 5
// // ];
//   const actualSymbols = [
//     '=', // 0
//     ' ', // 1
//     ' ', // 2
//     ' ', // 3
//     ' ', // 4
//     '=', // 5
//     '=', // 6
//   ];
//   const predictedSymbols = [
//     '-', // 0
//     ' ', // 1
//     ' ', // 2
//     ' ', // 3
//     ' ', // 4
//     '-', // 5
//   ];
//   const axisSymbols = [
//     '─', // 0
//     '┤', // 1
//     '┬', // 2
//     '┼', // 3
//   ];
//
//   const max = Math.max(...predicted, ...actual)
//   const min = Math.min(...predicted, ...actual)
//   const rows = max > 20 ? 20 : max;
//   const valueRowIndexPosition = (value: number) => {
//     const row = Math.ceil(((max - value) / max) * rows);
//     return row === rows ? rows - 1 : row;
//   };
//   const stepSize = max / rows;
//   const snapValueToStep = (value: number) => {
//     return Math.round(value/stepSize) * stepSize
//   }
//   const maxYLength = max.toString().length;
//   const maxYAxisOffset = (max + " " + axisSymbols[3]).length
//   const columnWidth = 2;
//
//   const columns = predicted.length * 2;
//   let canvas = Array.from({length: rows}, () => Array.from({length: columns}).fill(" "));
//   function drawSeries(series: number[], symbol: string, symbols: string[]) {
//     let prevRow = null;
//     for (let i = 0; i < columns; i = i + 2) {
//       const prevValue = i > 0 ? snapValueToStep(series[(i - 2) / 2]) : 0;
//       const value = snapValueToStep(series[i / 2]);
//       const nextValue = snapValueToStep(series[(i + 2) / 2]);
//
//       const column = i;
//       const columnValue = i + 1;
//       const columnNext = i + 2;
//
//       const row = valueRowIndexPosition(value);
//
//       if (i === 0) // First character must always be -
//         canvas[row][column] = symbols[0];
//       else if (prevValue > value)
//         canvas[row][column] = symbols[1];
//       else if (prevValue < value)
//         canvas[row][column] = symbols[2];
//       else
//         canvas[row][column] = symbols[0];
//
//       canvas[row][columnValue] = symbol;
//
//       if (nextValue > value)
//         canvas[row][columnNext] = symbols[4];
//       else if (nextValue < value)
//         canvas[row][columnNext] = symbols[3];
//       else
//         canvas[row][columnNext] = symbols[0];
//
//       // Straight line between these...
//       if (prevRow !== null) {
//         if (prevRow > row) {
//           for (let j = (row + 1); j < prevRow; j++) {
//             canvas[j][column] = symbols[5];
//           }
//         } else {
//           for (let j = (prevRow + 1); j < row; j++) {
//             canvas[j][column] = symbols[6];
//           }
//         }
//       }
//
//       prevRow = row;
//     }
//   }
//
//   drawSeries(predicted, '-', predictedSymbols);
//   drawSeries(actual, "=", actualSymbols);
//
//   /* Draw a star if breached */
//   for (let i = 0; i < columns; i = i + 2) {
//     const evaluation = evaluations[i / 2];
//     const columnValue = i + 1;
//     const row = valueRowIndexPosition(snapValueToStep(evaluation.value));
//     if (evaluation.breached)
//       canvas[row][columnValue] = "*";
//   }
//
//
//   /* Draw Y Axis */
//   for (let row = rows - 1; row >= 0; row--) {
//     const yValue = Math.ceil((stepSize * (rows - row)));
//     canvas[row].unshift(yValue.toString().padStart(maxYLength, "0"), " ", axisSymbols[1]); // Pad numbers with 0 because email does not have equal width characters
//   }
//
//
//   /* Draw Y Axis Ticks */
//   canvas.push(Array.from({length: columns + maxYAxisOffset}).fill(" "))
//   const yAxisPadding = Array(maxYAxisOffset - 1).fill(" ").join("");
//   for (let column = 0; column <= columns; column++) {
//     if (column === 0) {
//       canvas[canvas.length - 1][column] = yAxisPadding + axisSymbols[3];
//     } else if (column % 2 === 0) {
//       canvas[canvas.length - 1][column] = axisSymbols[2];
//     } else {
//       canvas[canvas.length - 1][column] = axisSymbols[0];
//     }
//   }
//
//   /* Draw X Axis Values */
//   canvas.push(Array.from({length: columns}).fill(" ")) // hour
//   canvas.push(Array.from({length: columns}).fill(" ")) // date
//   let prevDate = null;
//   let datesPainted = 0;
//   for (let column = 0; column <= (columns / columnWidth); column++) {
//     const hour = xValues[column] ? xValues[column].getHours().toString().padStart(2, "0") : null;
//     const hourRow = canvas.length - 2;
//     const dateRow = canvas.length - 1;
//
//     if (column === 0) {
//       canvas[hourRow][column] = yAxisPadding + "  " + hour;
//     } else if (column % 2 === 0) {
//       // Paint every second value
//       canvas[hourRow][column] = hour;
//     } else {
//       canvas[hourRow][column] = "  ";
//     }
//
//     const date = xValues[column] ? xValues[column].toString().slice(0, 10) : null;
//     if (column === 0) {
//       canvas[dateRow][column] = yAxisPadding + "  " + date;
//       datesPainted++;
//     } else if (date !== null && prevDate !== date) {
//       const newIndex = (column * 2) - (datesPainted * 10); // 10 is length of each date string
//       canvas[dateRow][newIndex + 1] = date;
//     }
//     prevDate = date;
//   }
//
//   return canvas.map(row => row.join("")).join('\n');
// }

