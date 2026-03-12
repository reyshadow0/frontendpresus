import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AnteproyectoService } from '../../../services/anteproyecto.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-cargar-anteproyecto',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './cargar-anteproyecto.component.html',
    styleUrls: ['./cargar-anteproyecto.component.css']
})
export class CargarAnteproyectoComponent implements OnInit {
    solicitudId!: number;
    archivoSeleccionado: File | null = null;
    subiendo = false;
    intentoEnvio = false;

    // Estado del anteproyecto existente
    anteproyectoExistente: any = null;
    cargando = true;
    bloqueado = false;  // true cuando no se puede reemplazar el PDF

    constructor(
        private route: ActivatedRoute,
        private anteproyectoService: AnteproyectoService,
        private notification: NotificationService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
        this.verificarEstado();
    }

    /** Consulta si ya existe un anteproyecto y si está bloqueado para re-subida */
    verificarEstado(): void {
        this.cargando = true;
        this.anteproyectoService.obtenerPorSolicitud(this.solicitudId).subscribe({
            next: (ap) => {
                this.anteproyectoExistente = ap;
                // Bloqueado si ya tiene PDF y el coordinador NO lo ha rechazado
                this.bloqueado = ap && ap.archivoPdf && ap.estado !== 'RECHAZADO';
                this.cargando = false;
            },
            error: () => {
                // 404 = no existe anteproyecto aún, se puede subir
                this.anteproyectoExistente = null;
                this.bloqueado = false;
                this.cargando = false;
            }
        });
    }

    get estadoBadge(): string {
        const e = this.anteproyectoExistente?.estado;
        if (e === 'ENVIADO')   return 'badge-enviado';
        if (e === 'APROBADO')  return 'badge-aprobado';
        if (e === 'RECHAZADO') return 'badge-rechazado';
        return '';
    }

    onFileSelected(event: any): void {
        const file: File = event.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            this.notification.error('Solo se permiten archivos en formato PDF.', 'Formato inválido');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.notification.error('El archivo supera los 10 MB permitidos.', 'Archivo muy grande');
            return;
        }
        this.archivoSeleccionado = file;
        this.intentoEnvio = false;
    }

    quitarArchivo(): void {
        this.archivoSeleccionado = null;
    }

    subirArchivo(): void {
        if (this.bloqueado) {
            this.notification.error(
                'No puedes reemplazar el PDF. El coordinador debe rechazar el anteproyecto para permitir una nueva carga.',
                'Acción no permitida'
            );
            return;
        }
        if (!this.archivoSeleccionado) {
            this.intentoEnvio = true;
            this.notification.error('Debes seleccionar un archivo PDF antes de enviar.', 'Sin archivo');
            return;
        }

        this.subiendo = true;
        this.anteproyectoService.enviarAnteproyecto(this.solicitudId, this.archivoSeleccionado).subscribe({
            next: () => {
                this.subiendo = false;
                this.notification.success('Anteproyecto enviado correctamente.', '¡Enviado!');
                this.router.navigate(['/dashboard/solicitudes/mis-tramites']);
            },
            error: (err) => {
                this.subiendo = false;
                const msg = err?.error?.mensaje || 'No se pudo enviar el anteproyecto.';
                this.notification.error(msg, 'Error');
            }
        });
    }
}