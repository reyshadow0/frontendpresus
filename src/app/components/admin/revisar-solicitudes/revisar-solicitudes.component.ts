import { Component, ViewEncapsulation, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ReporteService } from '../../../services/reporte.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-revisar-solicitudes',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './revisar-solicitudes.component.html',
    styleUrls: ['./revisar-solicitudes.component.css']
})
export class RevisarSolicitudesComponent implements OnInit {
    solicitudes: any[] = [];
    cargando = true;
    filtroEstado = '';
    modalObs: string | null = null;
    modalTitulo = '';

    // Modal de rechazo con observación
    modalRechazo = false;
    solicitudIdRechazo: number | null = null;
    observacionRechazo = '';

    constructor(
        private solicitudService: SolicitudService,
        private notification: NotificationService,
        private router: Router,
        private reporteService: ReporteService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.cargar();
        // Safety: stop spinner after 10s even if backend unreachable
        setTimeout(() => { if (this.cargando) this.cargando = false; }, 10000);
    }

    cargar(): void {
        this.cargando = true;
        this.solicitudService.listarSolicitudes().subscribe({
            next: (data) => { this.solicitudes = data; this.cargando = false; },
            error: () => { this.cargando = false; this.notification.error('Error al cargar solicitudes.', 'Error'); }
        });
    }

    get solicitudesFiltradas(): any[] {
        if (!this.filtroEstado) return this.solicitudes;
        return this.solicitudes.filter(s => s.estado === this.filtroEstado);
    }

    contar(estado: string): number {
        return this.solicitudes.filter(s => s.estado === estado).length;
    }

    setFiltro(estado: string): void { this.filtroEstado = estado; }

    inicialNombre(s: any): string {
        return (s.estudiante?.usuario?.nombre || 'E')[0].toUpperCase();
    }

    aprobar(id: number): void {
        this.solicitudService.aprobarSolicitud(id).subscribe({
            next: () => {
                // ★ Actualizar estado local inmediatamente sin recargar toda la lista
                const sol = this.solicitudes.find(s => s.id === id);
                if (sol) sol.estado = 'APROBADA';

                this.notification.success(
                    'Solicitud aprobada. Redirigiendo para asignar tribunal...',
                    '✓ Aprobada'
                );

                // ★ Navegar automáticamente a asignar tribunal tras 1.2s
                setTimeout(() => {
                    this.router.navigate(['/dashboard/admin/asignar-jurados', id]);
                }, 1200);
            },
            error: () => this.notification.error('No se pudo aprobar.', 'Error')
        });
    }

    abrirModalRechazo(id: number): void {
        this.solicitudIdRechazo = id;
        this.observacionRechazo = '';
        this.modalRechazo = true;
    }

    cerrarModalRechazo(): void {
        this.modalRechazo = false;
        this.solicitudIdRechazo = null;
        this.observacionRechazo = '';
    }

    confirmarRechazo(): void {
        if (!this.solicitudIdRechazo) return;
        if (!this.observacionRechazo.trim()) {
            this.notification.error('Debes ingresar el motivo del rechazo.', 'Campo requerido');
            return;
        }
        const idArechazar = this.solicitudIdRechazo;
        const obsAGuardar = this.observacionRechazo;

        this.solicitudService.rechazarConObservacion(idArechazar, obsAGuardar).subscribe({
            next: () => {
                // 1. Primero cerrar el modal
                this.modalRechazo = false;
                this.solicitudIdRechazo = null;
                this.observacionRechazo = '';
                this.cdr.detectChanges();

                // 2. Actualizar lista local
                const sol = this.solicitudes.find(s => s.id === idArechazar);
                if (sol) { sol.estado = 'RECHAZADA'; sol.observaciones = obsAGuardar; }

                // 3. Mostrar toast después de que Angular cierre el modal
                setTimeout(() => {
                    this.notification.success('Solicitud rechazada. El estudiante fue notificado.', '✓ Rechazada');
                }, 100);
            },
            error: () => this.notification.error('No se pudo rechazar.', 'Error')
        });
    }

    verObservaciones(titulo: string, obs: string): void {
        this.modalTitulo = titulo;
        this.modalObs = obs;
    }

    cerrarModal(): void { this.modalObs = null; }

    getBadge(estado: string): string {
        const m: Record<string,string> = {
            CREADA: 'badge-creada', ENVIADA: 'badge-enviada',
            APROBADA: 'badge-aprobada', RECHAZADA: 'badge-rechazada'
        };
        return m[estado] || 'badge-default';
    }

    descargarCronogramaPdf(): void {
        this.reporteService.cronogramaPdf().subscribe({
            next: (blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'cronograma_presustentaciones.pdf';
                a.click();
            },
            error: () => this.notification.error('No se pudo generar el PDF.', 'Error')
        });
    }

    descargarEstadisticasPdf(): void {
        this.reporteService.estadisticasPdf().subscribe({
            next: (blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'estadisticas_evaluaciones.pdf';
                a.click();
            },
            error: () => this.notification.error('No se pudo generar el reporte.', 'Error')
        });
    }
}