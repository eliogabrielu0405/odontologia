/* Configuración de la plataforma Tiendo.
   Lo único que se cambia aquí es el dominio cuando lo compres. */
window.EU_CONFIG = {
  // Base de datos (Supabase, proyecto "eudigital"). La clave "anon" es pública por diseño:
  // lo que protege los datos son los permisos de la base de datos.
  supabaseUrl: "https://rbssbogagijomskbzezv.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJic3Nib2dhZ2lqb21za2J6ZXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNzEwMDQsImV4cCI6MjEwOTk0NzAwNH0.RXKETjReiRIfCdTiwPDEBgWCfXW-X7S8vXIA4Thq6w4",

  // Cada cliente entra con su usuario (el mismo de su enlace) y su contraseña.
  // Por dentro, el usuario se convierte en este correo. No se envían correos.
  dominioCorreo: "clientes.eudigital.invalid",
  usuarioAdmin: "eudigital",

  // Cuando compres el dominio (por ejemplo "eudigital.com"), ponlo aquí y cada
  // cliente tendrá su dirección: pizzeria-luigi.eudigital.com
  dominioBase: "",

  marca: "Tiendo",
  whatsappMarca: "584144741237",

  // Avisos al teléfono de Tiendo cuando un cliente reporta un pago o alguien se registra.
  // Usan la tabla eu_avisos y la función eu-avisos (ver sql/2026-11-13_avisos.sql y supabase/functions/).
  avisos: true
};
