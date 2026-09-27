// Credenciales de conexión a Supabase
const SUPABASE_URL = "https://gbomxlrvhyauadnqywyr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TjF0NPwZR2bFW0mJzjNpFA_3212xMPo"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables Globales de Estado
let pacienteSeleccionado = null;
let consultasGuardadasMap = new Map(); // Para almacenar temporalmente las consultas y facilitar la edición/impresión

// Referencias de Vistas
const vistaPrincipal = document.getElementById("vista-principal");
const vistaDetalle = document.getElementById("vista-detalle");
const btnVolverInicio = document.getElementById("btn-volver-inicio");

// Elementos de la Vista Principal
const formPaciente = document.getElementById("form-paciente");
const inputBusqueda = document.getElementById("input-busqueda");
const filtroTipo = document.getElementById("filtro-tipo");
const btnBuscar = document.getElementById("btn-buscar");
const contenedorPacientes = document.getElementById("contenedor-pacientes");

// Elementos de la Vista Detalle
const infoPacienteDetalle = document.getElementById("info-paciente-detalle");
const formConsulta = document.getElementById("form-consulta");
const pacienteIdActual = document.getElementById("paciente-id-actual");
const listaHistorialClinico = document.getElementById("lista-historial-clinico");

// Ocultar botón antiguo de imprimir si existe en la interfaz
const btnImprimirViejo = document.getElementById("btn-imprimir-receta");
if (btnImprimirViejo) btnImprimirViejo.style.display = "none";

// Inicialización
document.addEventListener("DOMContentLoaded", cargarPacientes);

// NAVEGACIÓN ENTRE VISTAS
btnVolverInicio?.addEventListener("click", () => {
    if (vistaDetalle) vistaDetalle.style.display = "none";
    if (vistaPrincipal) vistaPrincipal.style.display = "block";
    pacienteSeleccionado = null;
    cargarPacientes();
});

// 1. GUARDAR PACIENTE
formPaciente?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value;
    const tipo = document.getElementById("tipo").value;
    const raza = document.getElementById("raza").value;
    const edad = document.getElementById("edad").value;
    const propietario = document.getElementById("propietario").value;
    const telefono = document.getElementById("telefono").value;
    const archivoFoto = document.getElementById("foto").files[0];

    const radicado = Math.floor(10000 + Math.random() * 90000);
    let fotoUrl = null;

    try {
        if (archivoFoto) {
            const fileExt = archivoFoto.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `pacientes/${fileName}`;

            const { data: storageData, error: storageError } = await supabaseClient
                .storage
                .from("fotos-mascotas")
                .upload(filePath, archivoFoto);

            if (storageError) throw storageError;

            const { data: urlData } = supabaseClient
                .storage
                .from("fotos-mascotas")
                .getPublicUrl(filePath);

            fotoUrl = urlData.publicUrl;
        }

        const nuevoPaciente = {
            radicado: radicado,
            nombre_mascota: nombre,
            tipo_animal: tipo,
            raza: raza,
            edad_anos: edad ? parseInt(edad) : null,
            nombre_propietario: propietario,
            telefono_propietario: telefono,
            foto_url: fotoUrl
        };

        const { data, error } = await supabaseClient
            .from("pacientes")
            .insert([nuevoPaciente])
            .select();

        if (error) throw error;

        alert(`¡Paciente registrado con éxito!\nN° de Radicado: ${radicado}`);
        formPaciente.reset();
        cargarPacientes();
    } catch (err) {
        console.error("Error al guardar paciente:", err);
        alert(`Ocurrió un error al guardar el paciente:\n${err.message || JSON.stringify(err)}`);
    }
});

// 2. CARGAR Y RENDERIZAR LISTA DE PACIENTES
async function cargarPacientes() {
    if (!contenedorPacientes) return;
    contenedorPacientes.innerHTML = "<p>Cargando lista de pacientes...</p>";

    try {
        const { data: pacientes, error } = await supabaseClient
            .from("pacientes")
            .select("*")
            .order("id", { ascending: false });

        if (error) throw error;

        renderizarPacientes(pacientes);
    } catch (err) {
        console.error("Error al obtener pacientes:", err);
        contenedorPacientes.innerHTML = "<p>Error al cargar la lista de pacientes.</p>";
    }
}

function renderizarPacientes(pacientes) {
    if (!pacientes || pacientes.length === 0) {
        contenedorPacientes.innerHTML = "<p>No hay pacientes registrados aún.</p>";
        return;
    }

    contenedorPacientes.innerHTML = "";

    pacientes.forEach((paciente) => {
        const card = document.createElement("div");
        card.className = "paciente-card";
        const imagenSrc = paciente.foto_url || 'https://via.placeholder.com/150?text=Sin+Foto';

        card.innerHTML = `
            <img src="${imagenSrc}" alt="${paciente.nombre_mascota}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
            <h3>🐾 ${paciente.nombre_mascota}</h3>
            <p><strong>Radicado:</strong> ${paciente.radicado || 'N/A'}</p>
            <p><strong>Tipo:</strong> ${paciente.tipo_animal}</p>
            <p><strong>Propietario:</strong> ${paciente.nombre_propietario}</p>
            <button class="btn-secondary" style="margin-top: 10px; width: 100%;" onclick="verHistorialDetalle('${paciente.id}')">Ver Historial Completo</button>
        `;
        contenedorPacientes.appendChild(card);
    });
}

// 3. FILTRO Y BÚSQUEDA
btnBuscar?.addEventListener("click", aplicarFiltros);

async function aplicarFiltros() {
    const busqueda = inputBusqueda ? inputBusqueda.value.trim().toLowerCase() : "";
    const tipo = filtroTipo ? filtroTipo.value : "todos";

    try {
        let query = supabaseClient.from("pacientes").select("*");

        if (tipo !== "todos") {
            query = query.eq("tipo_animal", tipo);
        }

        const { data: pacientes, error } = await query;
        if (error) throw error;

        const filtrados = pacientes.filter(p => 
            (p.nombre_mascota && p.nombre_mascota.toLowerCase().includes(busqueda)) ||
            (p.nombre_propietario && p.nombre_propietario.toLowerCase().includes(busqueda)) ||
            (p.radicado && String(p.radicado).includes(busqueda))
        );

        renderizarPacientes(filtrados);
    } catch (err) {
        console.error("Error al buscar:", err);
    }
}

// 4. ABRIR VISTA DE DETALLE DEL PACIENTE
window.verHistorialDetalle = async function(id) {
    try {
        const { data: paciente, error } = await supabaseClient
            .from("pacientes")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        pacienteSeleccionado = paciente;
        if (pacienteIdActual) pacienteIdActual.value = paciente.id;

        const imagenSrc = paciente.foto_url || 'https://via.placeholder.com/200?text=Sin+Foto';

        if (infoPacienteDetalle) {
            infoPacienteDetalle.innerHTML = `
                <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                    <img src="${imagenSrc}" alt="${paciente.nombre_mascota}" style="max-width: 180px; width: 100%; height: 180px; object-fit: cover; border-radius: 12px; border: 3px solid #2e7d32;">
                    <div>
                        <h2>🐾 ${paciente.nombre_mascota}</h2>
                        <p><strong>N° Radicado:</strong> ${paciente.radicado || 'N/A'}</p>
                        <p><strong>Especie / Raza:</strong> ${paciente.tipo_animal} - ${paciente.raza || 'No especificada'}</p>
                        <p><strong>Edad:</strong> ${paciente.edad_anos ? paciente.edad_anos + ' años' : 'No especificada'}</p>
                        <p><strong>Propietario:</strong> ${paciente.nombre_propietario}</p>
                        <p><strong>Teléfono:</strong> ${paciente.telefono_propietario || 'Sin teléfono'}</p>
                    </div>
                </div>
            `;
        }

        if (vistaPrincipal) vistaPrincipal.style.display = "none";
        if (vistaDetalle) vistaDetalle.style.display = "block";

        cargarConsultas(paciente.id);
    } catch (err) {
        console.error("Error al cargar detalle del paciente:", err);
    }
};

// 5. REGISTRAR NUEVA CONSULTA
formConsulta?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pId = pacienteIdActual ? pacienteIdActual.value : null;
    const motivoText = document.getElementById("motivo").value;
    const tratamientoText = document.getElementById("tratamiento").value;

    if (!pId) {
        alert("Error: No se ha detectado el ID del paciente.");
        return;
    }

    try {
        const pacienteIdFormateado = isNaN(pId) ? pId : parseInt(pId);

        const { data, error } = await supabaseClient
            .from("historial_clinico")
            .insert([
                { 
                    paciente_id: pacienteIdFormateado, 
                    motivo_consulta: motivoText, 
                    tratamiento: tratamientoText 
                }
            ]);

        if (error) throw error;

        alert("¡Consulta guardada correctamente en el historial!");
        document.getElementById("motivo").value = "";
        document.getElementById("tratamiento").value = "";
        cargarConsultas(pId);
    } catch (err) {
        console.error("Error al guardar consulta:", err);
        alert(`Ocurrió un error al guardar la consulta:\n${err.message || JSON.stringify(err)}`);
    }
});

// 6. CARGAR HISTORIAL DE CONSULTAS CON BOTONES EDITAR E IMPRIMIR
async function cargarConsultas(pId) {
    if (!listaHistorialClinico) return;
    listaHistorialClinico.innerHTML = "<p>Cargando consultas...</p>";
    
    try {
        const pacienteIdFormateado = isNaN(pId) ? pId : parseInt(pId);

        const { data: consultas, error } = await supabaseClient
            .from("historial_clinico")
            .select("*")
            .eq("paciente_id", pacienteIdFormateado)
            .order("id", { ascending: false });

        if (error) throw error;

        if (!consultas || consultas.length === 0) {
            listaHistorialClinico.innerHTML = "<p>No hay registro de consultas previas para esta mascota.</p>";
            return;
        }

        consultasGuardadasMap.clear();

        listaHistorialClinico.innerHTML = consultas.map(c => {
            consultasGuardadasMap.set(String(c.id), c);
            const motivoVal = c.motivo_consulta || c.motivo || c.diagnostico || '';
            const tratamientoVal = c.tratamiento || '';

            return `
                <div class="item-historial" id="consulta-card-${c.id}" style="background: #f9f9f9; padding: 15px; border-left: 4px solid #2e7d32; margin-bottom: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <p style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Consulta N°: ${c.id}</p>
                    
                    <div id="contenido-consulta-${c.id}">
                        <p style="margin-bottom: 5px;"><strong>Motivo / Diagnóstico:</strong> ${motivoVal}</p>
                        <p style="margin-bottom: 15px;"><strong>Tratamiento / Prescripción:</strong> ${tratamientoVal}</p>
                        
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button type="button" class="btn-secondary" style="background: #0288d1; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;" onclick="editarConsulta('${c.id}')">✏️ Editar Consulta</button>
                            <button type="button" class="btn-secondary" style="background: #2e7d32; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;" onclick="imprimirConsultaGuardada('${c.id}')">🖨️ Imprimir Orden Médica</button>
                        </div>
                    </div>

                    <div id="form-edicion-${c.id}" style="display: none; margin-top: 10px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Motivo / Diagnóstico:</label>
                        <textarea id="edit-motivo-${c.id}" style="width: 100%; height: 60px; margin-bottom: 10px; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">${motivoVal}</textarea>
                        
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Tratamiento / Prescripción:</label>
                        <textarea id="edit-tratamiento-${c.id}" style="width: 100%; height: 80px; margin-bottom: 10px; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">${tratamientoVal}</textarea>
                        
                        <div style="display: flex; gap: 10px;">
                            <button type="button" style="background: #2e7d32; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;" onclick="guardarEdicionConsulta('${c.id}')">💾 Guardar Cambios</button>
                            <button type="button" style="background: #757575; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;" onclick="cancelarEdicionConsulta('${c.id}')">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Error al cargar historial:", err);
        listaHistorialClinico.innerHTML = "<p>Error al cargar el historial clínico.</p>";
    }
}

// 7. FUNCIONES DE EDICIÓN DE CONSULTAS
window.editarConsulta = function(id) {
    document.getElementById(`contenido-consulta-${id}`).style.display = "none";
    document.getElementById(`form-edicion-${id}`).style.display = "block";
};

window.cancelarEdicionConsulta = function(id) {
    document.getElementById(`contenido-consulta-${id}`).style.display = "block";
    document.getElementById(`form-edicion-${id}`).style.display = "none";
};

window.guardarEdicionConsulta = async function(id) {
    const nuevoMotivo = document.getElementById(`edit-motivo-${id}`).value;
    const nuevoTratamiento = document.getElementById(`edit-tratamiento-${id}`).value;

    try {
        const consultaIdFormateado = isNaN(id) ? id : parseInt(id);

        const { error } = await supabaseClient
            .from("historial_clinico")
            .update({
                motivo_consulta: nuevoMotivo,
                tratamiento: nuevoTratamiento
            })
            .eq("id", consultaIdFormateado);

        if (error) throw error;

        alert("¡Consulta actualizada con éxito!");
        if (pacienteSeleccionado) {
            cargarConsultas(pacienteSeleccionado.id);
        }
    } catch (err) {
        console.error("Error al actualizar la consulta:", err);
        alert(`Ocurrió un error al actualizar:\n${err.message || JSON.stringify(err)}`);
    }
};

// 8. IMPRIMIR ORDEN MÉDICA DESDE EL HISTORIAL
window.imprimirConsultaGuardada = function(id) {
    const consulta = consultasGuardadasMap.get(String(id));

    if (!pacienteSeleccionado || !consulta) {
        alert("Error al obtener la información de la consulta.");
        return;
    }

    const motivoText = consulta.motivo_consulta || consulta.motivo || consulta.diagnostico || '';
    const tratamientoText = consulta.tratamiento || '';

    const ventanaImpresion = window.open("", "_blank");
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Orden Médica - ${pacienteSeleccionado.nombre_mascota}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; color: #333; line-height: 1.6; }
                .header { text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { margin: 0; color: #2e7d32; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; background: #f4f4f4; padding: 15px; border-radius: 6px; }
                .seccion { margin-bottom: 25px; }
                .seccion h3 { border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #1b5e20; }
                .firma { margin-top: 60px; text-align: center; }
                .linea-firma { border-top: 1px solid #000; width: 200px; margin: 0 auto 5px auto; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🐾 Clínica Veterinaria Historial Pet</h1>
                <p>Orden Médica y Receta de Tratamiento</p>
            </div>

            <div class="info-grid">
                <p><strong>Paciente:</strong> ${pacienteSeleccionado.nombre_mascota}</p>
                <p><strong>Radicado N°:</strong> ${pacienteSeleccionado.radicado || 'N/A'}</p>
                <p><strong>Especie/Raza:</strong> ${pacienteSeleccionado.tipo_animal} / ${pacienteSeleccionado.raza || 'N/A'}</p>
                <p><strong>Edad:</strong> ${pacienteSeleccionado.edad_anos ? pacienteSeleccionado.edad_anos + ' años' : 'N/A'}</p>
                <p><strong>Propietario:</strong> ${pacienteSeleccionado.nombre_propietario}</p>
                <p><strong>Fecha:</strong> ${new Date(consulta.created_at || Date.now()).toLocaleDateString('es-ES')}</p>
            </div>

            ${motivoText ? `
            <div class="seccion">
                <h3>Diagnóstico / Motivo de Consulta</h3>
                <p>${motivoText}</p>
            </div>` : ''}

            <div class="seccion">
                <h3>💊 Medicación y Prescripción Médica</h3>
                <p style="white-space: pre-line;">${tratamientoText}</p>
            </div>

            <div class="firma">
                <div class="linea-firma"></div>
                <p><strong>Firma Médico Veterinario</strong></p>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    ventanaImpresion.document.close();
};

// Botón para limpiar foto
document.getElementById("btn-limpiar-foto")?.addEventListener("click", () => {
    document.getElementById("foto").value = "";
});