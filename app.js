const mongoose = require('mongoose');
const express = require('express');
const path = require('path'); 
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
// app.js
// Ajusta la ruta según la ubicación real de tu archivo de utilidades
// utilidades.js y app.js


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


mongoose.connect('mongodb://127.0.0.1:27017/colegio', { useNewUrlParser: true, useUnifiedTopology: true });

const alumnoSchema = new mongoose.Schema({
  nombre: String,
  edad: Number,
  pagoRealizado: { type: Boolean, default: false },
  nivelEducativo: {
    type: String,
    enum: ['Primaria', 'Basico', 'Bachillerato']
  },

  pagos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pago' }],
  cargo: { type: Number, default: 0 }  // Agregar la propiedad 'cargo'
});

const Alumno = mongoose.model('Alumno', alumnoSchema);
// Definir el modelo para los pagos
const pagoSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  alumnoId: mongoose.Schema.Types.ObjectId,
  metodoPago: String,
  abono: { type: Number, default: 0 }, // Valor por defecto 0
  saldo: { type: Number, default: 0 }, // Valor por defecto 0
  descuentoAdelantado: { type: Number, default: 0 }, // Valor por defecto 0
  cargo: { type: Number, default: 0 }, // Valor por defecto 0
  meses: String
});


const Pago = mongoose.model('Pago', pagoSchema);

app.get('/alumnos', async (req, res) => {
  try {
    const alumnos = await Alumno.find();
    res.render('alumnos', { alumnos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener la lista de alumnos');
  }
});

app.post('/marcar-pago', async (req, res) => {
  try {
      const alumnoId = req.body.alumnoId;
      // Actualiza el alumno en la base de datos para marcar el pago como realizado
      await Alumno.findByIdAndUpdate(alumnoId, { pagoRealizado: true });
      res.redirect('/alumnos'); // Redirige de vuelta a la lista de alumnos
  } catch (error) {
      console.error(error);
      res.status(500).send('Error al marcar el pago');
  }
});



app.get('/alumnos/nuevo', (req, res) => {
  res.render('nuevo');
});

app.post('/alumnos/nuevo', async (req, res) => {
  const nuevoAlumno = new Alumno(req.body);

  // Añadir lógica para calcular el cargo según el nivel educativo
  switch (nuevoAlumno.nivelEducativo) {
    case 'Primaria':
      nuevoAlumno.cargo = 1000;
      break;
    case 'Basico':
      nuevoAlumno.cargo = 2000;
      break;
    case 'Bachillerato':
      nuevoAlumno.cargo = 3500;
      break;
    default:
      nuevoAlumno.cargo = 0;
      break;
  }

  try {
    await nuevoAlumno.save();
    res.redirect('/alumnos');
  } catch (error) {
    res.status(400).send(error);
  }
});



app.get('/alumnos/editar/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    res.render('editar', { alumno });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/alumnos/editar/:id', async (req, res) => {
  try {
    const { nivelEducativo } = req.body;

    // Actualizar el cargo según el nivel educativo
    req.body.cargo = calcularCargo(nivelEducativo);

    await Alumno.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/alumnos');
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get('/alumnos/eliminar/:id', async (req, res) => {
  try {
    await Alumno.findByIdAndDelete(req.params.id);
    res.redirect('/alumnos');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get('/alumnos/pago/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    res.render('registrarPago', { alumno });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener la información del alumno');
  }
});

app.post('/alumnos/pago/:id', async (req, res) => {
  const alumnoId = req.params.id;
  const { metodoPago, monto, abono, meses } = req.body;

  try {
    // Obtener el alumno para determinar el nivel educativo y el cargo
    const alumno = await Alumno.findById(alumnoId);
    
    // Realizar el cálculo del cargo según el nivel educativo
    const cargo = calcularCargo(alumno.nivelEducativo);

    // Calcular el abono y el saldo
    const abonoNumerico = parseFloat(abono);
    if (isNaN(abonoNumerico)) {
      return res.status(400).send('El abono debe ser un número válido');
    }

    // Validar que el abono no sea mayor al cargo actual
    if (abonoNumerico > alumno.cargo) {
      return res.status(400).send('El abono no puede ser mayor al cargo actual');
    }

    // Calcular el nuevo cargo después del abono
    const nuevoCargo = alumno.cargo - abonoNumerico;

    // Guardar el pago en la base de datos
    const nuevoPago = new Pago({
      alumnoId,
      metodoPago,
      abono: abonoNumerico,
      saldo: nuevoCargo,
      meses,
      cargo: cargo  // Mantener el valor original del cargo en el pago
    });

    await nuevoPago.save();

    // Actualizar el campo cargo en el modelo del alumno
    await Alumno.findByIdAndUpdate(alumnoId, { cargo: nuevoCargo });

    // Redirigir a la página de detalles del alumno
    res.redirect(`/alumnos/detalles/${alumnoId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al registrar el pago');
  }
});

function calcularCargo(nivelEducativo) {
  switch (nivelEducativo) {
    case 'Primaria':
      return 1000;
    case 'Basico':
      return 2000;
    case 'Bachiller':
      return 3500;
    default:
      return 0;
  }
}

function calcularAbono(nivelEducativo, monto, meses) {
  let abonoBase;

  switch (nivelEducativo) {
    case 'Primaria':
      abonoBase = 100;
      break;
    case 'Basico':
      abonoBase = 200;
      break;
    case 'Bachiller':
      abonoBase = 350;
      break;
    default:
      abonoBase = 0;
  }

  return abonoBase * meses;
}




app.get('/alumnos/detalles/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    const pagos = await Pago.find({ alumnoId: req.params.id });

    res.render('detallesAlumno', { alumno, pagos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener la información del alumno');
  }
});

function obtenerPagosPorPeriodo(periodo) {
  // Implementa la lógica para obtener los pagos según el período
  // Utiliza funciones de agregación de MongoDB o filtros según las fechas

  // Ejemplo: Obtener pagos de los últimos 7 días
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 7);

  return Pago.find({ fecha: { $gte: fechaLimite } });
}

app.get('/reportes', async (req, res) => {
  try {
    const pagos = await obtenerPagosPorPeriodo(req.query.periodo);

    // Recuperar los nombres de los alumnos asociados a los pagos
    const pagosConNombres = await Promise.all(
      pagos.map(async (pago) => {
        const alumno = await Alumno.findById(pago.alumnoId);
        return {
          ...pago.toObject(),
          nombreAlumno: alumno ? alumno.nombre : 'N/A',
        };
      })
    );

    res.render('reporte.ejs', { pagos: pagosConNombres, periodo: req.query.periodo });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar el reporte');
  }
});

async function obtenerAlumnosPorNivel() {
  try {
    const resultado = await Alumno.find().select('nombre edad nivelEducativo');
    return resultado;
  } catch (error) {
    console.error(error);
    throw error;
  }
}


// Agrega esto en tu archivo app.js
// Agrega esto en tu archivo app.js
app.get('/reporte-alumnos', async (req, res) => {
  try {
    // Utiliza obtenerAlumnosPorNivel para obtener los alumnos
    const nivelEducativo = req.query.nivelEducativo || '';
    const alumnosPorNivel = await obtenerAlumnosPorNivel(nivelEducativo);

    // Renderiza la vista con los alumnos obtenidos
    res.render('reporteAlumnos', { alumnosPorNivel });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar el reporte de alumnos por nivel educativo');
  }
});



// Ruta para el reporte de alumnos pendientes de pago
app.get('/reporte-pendientes', async (req, res) => {
  try {
      // Obtén la lista de alumnos pendientes de pago
      const alumnosPendientes = await Alumno.find({ pagoRealizado: false });
      res.render('reportePendientes', { alumnosPendientes });
  } catch (error) {
      console.error(error);
      res.status(500).send('Error al generar el reporte de alumnos pendientes de pago');
  }
});







app.listen(port, () => {
  console.log(`La aplicación está escuchando en http://localhost:${port}/alumnos`);
});
