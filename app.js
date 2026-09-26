// Credenciales de conexión a Supabase
const SUPABASE_URL = "https://gbomxlrvhyauadnqywyr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TjF0NPwZR2bFW0mJzjNpFA_3212xMPo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos del DOM
const formPaciente = document.getElementById("form-paciente");
const inputBusqueda = document.getElementById("input-busqueda");
const btnBuscar = document.getElementById("btn-buscar");
const contenedorPacientes = document.getElementById("contenedor-pacientes");

// Elementos del Modal
const modalHistorial = document.getElementById("modal-historial");
const cerrarModal = document.getElementById("cerrar-modal");
const formConsulta = document.getElementById("form-consulta");
const modalTituloPaciente = document.getElementById("modal-titulo-paciente");
const pacienteIdActual = document.getElementById("paciente-id-actual");
const listaHistorialClinico = document.getElementById("lista-historial-clinico");

// Eventos iniciales
document.addEventListener("DOMContentLoaded", () => {
  cargarPacientes();
});

cerrarModal.addEventListener("click", () => {
  modalHistorial.style.display = "none";
});

// Guardar un nuevo paciente
formPaciente.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre_mascota = document.getElementById("nombre_mascota").value;
  const tipo_animal = document.getElementById("tipo_animal").value;
  const raza = document.getElementById("raza").value;
  const edad_anos = document.getElementById("edad_anos").value;
  const nombre_propietario = document.getElementById("nombre_propietario").value;
  const telefono_propietario = document.getElementById("telefono_propietario").value;
  const archivoFoto = document.getElementById("foto_mascota").files[0];

  let foto_url = null;

  try {
    if (archivoFoto) {
      const nombreArchivo = `${Date.now()}_${archivoFoto.name}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("fotos-mascotas")
        .upload(nombreArchivo, archivoFoto);

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("fotos-mascotas")
        .getPublicUrl(nombreArchivo);

      foto_url = urlData.publicUrl;
    }

    const { data, error } = await supabase.from("pacientes").insert([
      {
        nombre_mascota,
        tipo_animal,
        raza,
        edad_anos: edad_anos ? parseInt(edad_anos) : null,
        nombre_propietario,
        telefono_propietario,
        foto_url
      }
    ]);

    if (error) throw error;

    alert("¡Paciente ingresado exitosamente!");
    formPaciente.reset();
    cargarPacientes();

  } catch (error) {
    alert("Error al guardar paciente: " + error.message);
  }
});

// Buscar Pacientes
btnBuscar.addEventListener("click", () => {
  cargarPacientes(inputBusqueda.value.trim());
});

async function cargarPacientes(criterio = "") {
  contenedorPacientes.innerHTML = '<p class="loading-text">Cargando...</p>';

  let query = supabase.from("pacientes").select("*").order("creado_en", { ascending: false });

  if (criterio !== "") {
    const esNumero = !isNaN(criterio);
    if (esNumero) {
      query = query.eq("radicado", parseInt(criterio));
    } else {
      query = query.or(`nombre_mascota.ilike.%${criterio}%,nombre_propietario.ilike.%${criterio}%`);
    }
  }

  const { data: pacientes, error } = await query;

  if (error) {
    contenedorPacientes.innerHTML = `<p>Error al cargar: ${error.message}</p>`;
    return;
  }

  if (pacientes.length === 0) {
    contenedorPacientes.innerHTML = "<p>No se encontraron registros de pacientes.</p>";
    return;
  }

  contenedorPacientes.innerHTML = pacientes.map(p => `
    <div class="card-paciente">
      <span class="badge-radicado">Rad: #${p.radicado}</span>
      <img src="${p.foto_url || 'https://via.placeholder.com/300x180?text=Sin+Foto'}" alt="${p.nombre_mascota}" class="paciente-foto">
      <h3>${p.nombre_mascota} <small>(${p.tipo_animal})</small></h3>
      <p><strong>Raza:</strong> ${p.raza || 'N/A'}</p>
      <p><strong>Propietario:</strong> ${p.nombre_propietario}</p>
      <button class="btn-secondary btn-historial" onclick="abrirHistorial('${p.id}', '${p.nombre_mascota}')">📖 Ver / Agregar Historial</button>
    </div>
  `).join("");
}

// Abrir Modal de Historial
window.abrirHistorial = async function(idPaciente, nombreMascota) {
  pacienteIdActual.value = idPaciente;
  modalTituloPaciente.innerText = `Historial Clínico: ${nombreMascota}`;
  modalHistorial.style.display = "block";
  cargarHistorial(idPaciente);
};

// Cargar consultas del historial
async function cargarHistorial(idPaciente) {
  listaHistorialClinico.innerHTML = "<p>Cargando registros...</p>";

  const { data: consultas, error } = await supabase
    .from("historial_clinico")
    .select("*")
    .eq("paciente_id", idPaciente)
    .order("fecha", { ascending: false });

  if (error) {
    listaHistorialClinico.innerHTML = `<p>Error: ${error.message}</p>`;
    return;
  }

  if (consultas.length === 0) {
    listaHistorialClinico.innerHTML = "<p>No hay consultas registradas para esta mascota.</p>";
    return;
  }

  listaHistorialClinico.innerHTML = consultas.map(c => `
    <div class="item-historial">
      <div class="fecha">📅 ${new Date(c.fecha).toLocaleString()} - Vet: ${c.veterinario || 'No especificado'}</div>
      <p><strong>Motivo:</strong> ${c.motivo_consulta}</p>
      <p><strong>Diagnóstico:</strong> ${c.diagnostico || 'N/A'}</p>
      <p><strong>Tratamiento:</strong> ${c.tratamiento || 'N/A'}</p>
    </div>
  `).join("");
}

// Guardar nueva consulta médica en la tabla historial_clinico
formConsulta.addEventListener("submit", async (e) => {
  e.preventDefault();

  const idPaciente = pacienteIdActual.value;
  const motivo_consulta = document.getElementById("motivo_consulta").value;
  const diagnostico = document.getElementById("diagnostico").value;
  const tratamiento = document.getElementById("tratamiento").value;
  const veterinario = document.getElementById("veterinario").value;

  try {
    const { error } = await supabase.from("historial_clinico").insert([
      {
        paciente_id: idPaciente,
        motivo_consulta,
        diagnostico,
        tratamiento,
        veterinario
      }
    ]);

    if (error) throw error;

    alert("¡Consulta guardada exitosamente!");
    formConsulta.reset();
    cargarHistorial(idPaciente);

  } catch (error) {
    alert("Error al guardar la consulta: " + error.message);
  }
});