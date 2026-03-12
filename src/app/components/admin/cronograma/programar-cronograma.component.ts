import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CronogramaService } from '../../../services/cronograma.service';
import { SalaService } from '../../../services/sala.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-programar-cronograma',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './programar-cronograma.component.html',
    styleUrls: ['./programar-cronograma.component.css']
})
export class ProgramarCronogramaComponent implements OnInit {
    form!: FormGroup;
    salas: any[] = [];
    solicitud: any = null;
    solicitudId!: number;
    enviando = false;
    asignandoAuto = false;
    cronogramaExistente: any = null;
    errorConflicto: string | null = null;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private cronogramaService: CronogramaService,
        private salaService: SalaService,
        private solicitudService: SolicitudService,
        private notification: NotificationService
    ) {}

    ngOnInit(): void {
        this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
        this.form = this.fb.group({
            fecha: ['', Validators.required],
            hora: ['', Validators.required],
            salaId: ['', Validators.required]
        });
        this.cargarDatos();
    }

    cargarDatos(): void {
        this.salaService.listar().subscribe(s => this.salas = s);
        this.solicitudService.obtenerPorId(this.solicitudId).subscribe(s => this.solicitud = s);
        this.cronogramaService.porSolicitud(this.solicitudId).subscribe({
            next: (c) => this.cronogramaExistente = c,
            error: () => this.cronogramaExistente = null
        });
    }

    guardar(): void {
        if (this.form.invalid) return;
        this.enviando = true;
        this.errorConflicto = null;
        const { fecha, hora, salaId } = this.form.value;
        this.cronogramaService.crearCronograma(this.solicitudId, salaId, fecha, hora).subscribe({
            next: (c) => {
                this.enviando = false;
                this.cronogramaExistente = c;
                this.notification.success('Pre-sustentación programada correctamente.', '¡Programado!');
                setTimeout(() => this.router.navigate(['/dashboard/admin/revisar-solicitudes']), 1500);
            },
            error: (err) => {
                this.enviando = false;
                // RF-04: mostrar error de conflicto específico
                this.errorConflicto = err.error?.error || 'No se pudo programar. Verifica la disponibilidad.';
                this.notification.error(this.errorConflicto!, 'Conflicto de horario');
            }
        });
    }

    /** RF-04: Asignación automática sin conflictos */
    asignarAutomatico(): void {
        this.asignandoAuto = true;
        this.errorConflicto = null;
        this.cronogramaService.asignarAutomatico(this.solicitudId).subscribe({
            next: (c) => {
                this.asignandoAuto = false;
                this.cronogramaExistente = c;
                this.notification.success(
                    `Asignado automáticamente: ${this.formatFecha(c.fechaInicio)} — Sala: ${c.sala?.nombre}`,
                    '✓ Cronograma automático'
                );
            },
            error: (err) => {
                this.asignandoAuto = false;
                this.errorConflicto = err.error?.error || 'No se encontró disponibilidad automática.';
                this.notification.error(this.errorConflicto!, 'Sin disponibilidad');
            }
        });
    }

    eliminarCronograma(): void {
        if (!this.cronogramaExistente) return;
        this.cronogramaService.eliminar(this.cronogramaExistente.id).subscribe({
            next: () => { this.cronogramaExistente = null; this.notification.success('Cronograma eliminado.', 'Eliminado'); }
        });
    }

    formatFecha(f: string): string {
        if (!f) return '—';
        return new Date(f).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
    }
}