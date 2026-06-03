// Worker en segundo plano para procesar métricas del inventario
console.log("Web Worker inicializado correctamente.");

// ==========================================================================
// WEB WORKER: PROCESAMIENTO DE MÉTRICAS EN SEGUNDO PLANO
// ==========================================================================

// Escuchar cuando app.js le envíe el arreglo de equipos
self.onmessage = function(event) {
    try {
        const inventario = event.data;

        // Realizar los cálculos matemáticos fuera del hilo principal
        const total = inventario.length;
        
        const enMantenimiento = inventario.filter(
            equipo => equipo.estado === "Mantenimiento"
        ).length;

        // Enviar los resultados de vuelta a app.js
        self.postMessage({
            totalEquipos: total,
            mantenimientoEquipos: enMantenimiento
        });

    } catch (error) {
        console.error("Error dentro del Web Worker:", error);
    }
};