/* Datos de ejemplo de DentaGest.
   Se usan en la versión que funciona solo en el navegador y para cargar la demo en la base
   compartida del artefacto (tools/export-seed.mjs). Las contraseñas se cifran antes de guardarse. */
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const DEMO_ACCOUNTS = [
    { label: 'Administrador', email: 'admin@dentagest.com', password: 'admin123' },
    { label: 'Odontólogo', email: 'crodriguez@dentagest.com', password: 'demo123' },
    { label: 'Recepción', email: 'recepcion@dentagest.com', password: 'demo123' },
  ];

  const buildSeed = (today = new Date()) => {
    const d = (n) => iso(addDays(today, n));

    const users = [
      { id: 'u1', firstName: 'Admin', lastName: 'Sistema', email: 'admin@dentagest.com', password: 'admin123', role: 'admin', specialty: '', phone: '', active: true, color: '#0d9488' },
      { id: 'u2', firstName: 'Carlos', lastName: 'Rodríguez', email: 'crodriguez@dentagest.com', password: 'demo123', role: 'odontologo', specialty: 'Odontología general', phone: '11 4455-1020', active: true, color: '#0284c7' },
      { id: 'u3', firstName: 'María', lastName: 'González', email: 'mgonzalez@dentagest.com', password: 'demo123', role: 'odontologo', specialty: 'Ortodoncia', phone: '11 4455-1021', active: true, color: '#7c3aed' },
      { id: 'u4', firstName: 'Andrés', lastName: 'López', email: 'alopez@dentagest.com', password: 'demo123', role: 'odontologo', specialty: 'Endodoncia', phone: '11 4455-1022', active: true, color: '#d97706' },
      { id: 'u5', firstName: 'Laura', lastName: 'Martínez', email: 'lmartinez@dentagest.com', password: 'demo123', role: 'odontologo', specialty: 'Implantología', phone: '11 4455-1023', active: true, color: '#db2777' },
      { id: 'u6', firstName: 'Julieta', lastName: 'Paz', email: 'recepcion@dentagest.com', password: 'demo123', role: 'recepcion', specialty: '', phone: '11 4455-1000', active: true, color: '#475569' },
    ];

    const names = [
      ['María', 'García', 'F', '1988-03-14'], ['Roberto', 'Fernández', 'M', '1975-07-02'], ['Luciana', 'Martínez', 'F', '1992-11-21'],
      ['Carlos', 'López', 'M', '1980-01-30'], ['Ana', 'Rodríguez', 'F', '1995-05-09'], ['Diego', 'Sánchez', 'M', '1987-09-17'],
      ['Valentina', 'Torres', 'F', '2001-12-03'], ['Martín', 'Díaz', 'M', '1980-04-25'], ['Sofía', 'Romero', 'F', '1999-08-11'],
      ['Federico', 'Morales', 'M', '1969-02-08'], ['Camila', 'Herrera', 'F', '2012-06-19'], ['Joaquín', 'Benítez', 'M', '1990-10-05'],
    ];
    const insurers = ['OSDE', 'Swiss Medical', 'Galeno', 'Particular', 'IOMA', 'Medifé'];
    const patients = names.map(([firstName, lastName, sex, birthDate], i) => ({
      id: `p${i + 1}`, firstName, lastName, sex, birthDate,
      dni: String(25000000 + i * 1234567).slice(0, 8),
      phone: `11 ${5000 + i * 37}-${1000 + i * 91}`,
      email: `${firstName}.${lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@mail.com',
      address: `Av. Siempre Viva ${100 + i * 15}, CABA`,
      insurance: insurers[i % insurers.length],
      insuranceNumber: insurers[i % insurers.length] === 'Particular' ? '' : String(800000 + i * 731),
      allergies: i % 4 === 0 ? 'Penicilina' : '',
      medications: i % 5 === 1 ? 'Enalapril 10 mg' : '',
      conditions: i % 6 === 2 ? 'Hipertensión' : '',
      notes: '',
      createdAt: d(-120 + i * 9),
    }));

    const treatments = [
      ['Consulta y diagnóstico', 'Diagnóstico', 15000, 30], ['Radiografía periapical', 'Diagnóstico', 8000, 15],
      ['Limpieza y profilaxis', 'Prevención', 22000, 45], ['Aplicación de flúor', 'Prevención', 9000, 20], ['Sellador de fosas', 'Prevención', 12000, 20],
      ['Obturación con resina (1 cara)', 'Operatoria', 28000, 40], ['Obturación con resina (2+ caras)', 'Operatoria', 36000, 60],
      ['Endodoncia unirradicular', 'Endodoncia', 85000, 60], ['Endodoncia multirradicular', 'Endodoncia', 120000, 90],
      ['Raspaje y alisado radicular', 'Periodoncia', 40000, 60], ['Extracción simple', 'Cirugía', 35000, 30], ['Extracción de tercer molar', 'Cirugía', 90000, 60],
      ['Corona de porcelana', 'Prótesis', 180000, 60], ['Prótesis removible parcial', 'Prótesis', 220000, 60],
      ['Control de ortodoncia', 'Ortodoncia', 25000, 30], ['Brackets metálicos (instalación)', 'Ortodoncia', 350000, 90],
      ['Implante dental', 'Implantes', 600000, 120], ['Blanqueamiento en consultorio', 'Estética', 120000, 60],
    ].map(([name, category, price, duration], i) => ({ id: `t${i + 1}`, name, category, price, duration, description: '' }));

    const dentists = users.filter((u) => u.role === 'odontologo');
    const times = ['09:00', '09:30', '10:00', '11:00', '11:30', '12:00', '14:00', '15:00', '15:30', '16:30', '17:00', '18:00'];
    const appointments = [];
    let a = 1;
    for (let day = -8; day <= 10; day++) {
      const date = addDays(today, day);
      if (date.getDay() === 0) continue;
      const count = date.getDay() === 6 ? 2 : 3;
      for (let k = 0; k < count; k++) {
        const p = patients[(a * 7 + k) % patients.length];
        const t = treatments[(a * 3 + k) % treatments.length];
        const dentist = dentists[(a + k) % dentists.length];
        let status = 'programada';
        if (day < 0) status = a % 9 === 0 ? 'ausente' : a % 11 === 0 ? 'cancelada' : 'atendida';
        else if (day <= 2) status = a % 2 ? 'confirmada' : 'programada';
        appointments.push({
          id: `a${a}`, patientId: p.id, dentistId: dentist.id, treatmentId: t.id, date: iso(date),
          time: times[(a + k * 3) % times.length], duration: t.duration >= 60 ? 60 : 30, status, notes: '',
        });
        a++;
      }
    }

    const budgetDefs = [
      ['p1', 'u2', [['t6', 2], ['t3', 1]], 'en_curso', -40], ['p2', 'u3', [['t15', 1]], 'aceptado', -35], ['p3', 'u2', [['t6', 1]], 'aceptado', -30],
      ['p4', 'u4', [['t8', 1], ['t13', 1]], 'finalizado', -60], ['p5', 'u5', [['t3', 1]], 'aceptado', -12], ['p6', 'u2', [['t9', 1]], 'pendiente', -5],
      ['p7', 'u2', [['t7', 1]], 'finalizado', -50], ['p8', 'u3', [['t16', 1]], 'aceptado', -25], ['p9', 'u4', [['t18', 1]], 'pendiente', -3],
      ['p10', 'u2', [['t12', 1]], 'pendiente', -2], ['p12', 'u5', [['t17', 1]], 'rechazado', -45],
    ];
    const treatmentById = Object.fromEntries(treatments.map((t) => [t.id, t]));
    const budgets = budgetDefs.map(([patientId, dentistId, items, status, day], i) => ({
      id: `b${i + 1}`, number: 1001 + i, patientId, dentistId, status, date: d(day), notes: '', discount: 0,
      items: items.map(([treatmentId, qty]) => ({ treatmentId, description: treatmentById[treatmentId].name, qty, price: treatmentById[treatmentId].price, tooth: '' })),
    }));

    const budgetTotal = (b) => b.items.reduce((s, it) => s + it.qty * it.price, 0) * (1 - (b.discount || 0) / 100);
    const methods = ['Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito'];
    const payments = [];
    let receipt = 2001;
    budgets.forEach((b, i) => {
      if (b.status === 'pendiente' || b.status === 'rechazado') return;
      const total = budgetTotal(b);
      const parts = b.status === 'finalizado' ? [1] : i % 2 ? [0.5] : [0.3, 0.3];
      parts.forEach((part, j) => {
        payments.push({
          id: `pay${payments.length + 1}`, patientId: b.patientId, budgetId: b.id, amount: Math.round(total * part),
          method: methods[(i + j) % methods.length], date: d(Math.min(0, -26 + i * 3 + j * 9)),
          concept: `Pago presupuesto #${b.number}`, receipt: `R-${String(receipt++).padStart(6, '0')}`,
        });
      });
    });

    const history = [
      { id: 'h1', patientId: 'p8', dentistId: 'u3', date: d(-25), title: 'Primera consulta de ortodoncia', notes: 'Apiñamiento anteroinferior leve. Se solicitan radiografía panorámica y telerradiografía.' },
      { id: 'h2', patientId: 'p8', dentistId: 'u2', date: d(-14), title: 'Obturación pieza 14', notes: 'Caries oclusal en 14. Se realiza obturación con resina A2. Sin complicaciones.' },
      { id: 'h3', patientId: 'p1', dentistId: 'u2', date: d(-20), title: 'Limpieza y control', notes: 'Sarro moderado en sector anteroinferior. Se indica técnica de cepillado.' },
    ];

    const consents = [
      { id: 'c1', patientId: 'p8', type: 'Tratamiento de ortodoncia', date: d(-25), signed: true, notes: 'Firmado en consultorio.' },
    ];

    // Caras por posición en pantalla: t (arriba), b (abajo), l (izquierda), r (derecha), c (centro).
    const odontograms = {
      p8: { 14: { faces: { c: 'obturacion', r: 'caries' } }, 15: { faces: { t: 'caries' } }, 12: { faces: { c: 'obturacion' } }, 21: { whole: 'corona' }, 25: { whole: 'extraccion' }, 46: { faces: { l: 'caries' } }, 33: { whole: 'endodoncia' } },
      p4: { 36: { whole: 'endodoncia' }, 37: { whole: 'corona' }, 18: { whole: 'ausente' } },
      p1: { 16: { faces: { c: 'obturacion' } }, 26: { faces: { c: 'caries' } } },
    };

    const settings = {
      clinicName: 'Clínica Dental Sonrisas', taxId: '30-71234567-8', phone: '11 4455-1000', email: 'contacto@sonrisas.com',
      address: 'Av. Corrientes 1234, CABA', openTime: '09:00', closeTime: '19:00', workDays: 'Lunes a sábado',
      slotMinutes: 30, receiptFooter: 'Gracias por confiar en nosotros.',
      exampleData: true,
      demoAccounts: DEMO_ACCOUNTS,
    };

    return { users, patients, treatments, appointments, budgets, payments, history, consents, activity: [], odontograms, settings };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = buildSeed;
  else root.DentaSeed = buildSeed;
})(typeof window !== 'undefined' ? window : globalThis);
