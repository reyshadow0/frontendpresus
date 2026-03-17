import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { JuradoService } from '../../../services/jurado.service';
import { DocenteService } from '../../../services/docente.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { NotificationService } from '../../../services/notification.service';
import { TutoriaService } from '../../../services/tutoria.service';
import { AuthService } from '../../../services/auth.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-asignar-jurados',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './asignar-jurados.component.html',
    styleUrls: ['./asignar-jurados.component.css']
})
export class AsignarJuradosComponent implements OnInit {
    solicitudId!: number;
    solicitud: any = null;
    jurados: any[] = [];
    tutor: any = null;
    docentesSugeridos: any[] = [];
    todosDocentes: any[] = [];   // ← lista completa para dropdowns
    cargando = true;
    procesando = false;
    tutoriaCompletada: boolean | null = null;  // null = verificando
    tutoriaTieneAsignacion = false;            // false = sin tutor asignado aún
    tutoriaFasesAprobadas = 0;

    formJurado!: FormGroup;
    formTutor!: FormGroup;

    readonly ROLES = [
        { value: 'PRESIDENTE', label: 'Presidente del Tribunal' },
        { value: 'VOCAL_1',    label: 'Vocal 1' },
        { value: 'VOCAL_2',    label: 'Vocal 2' },
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private fb: FormBuilder,
        private juradoService: JuradoService,
        private docenteService: DocenteService,
        private solicitudService: SolicitudService,
        private notification: NotificationService,
        private tutoriaService: TutoriaService,
        private authService: AuthService
    ) {}

    ngOnInit(): void {
        this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
        this.formJurado = this.fb.group({
            docenteId: ['', Validators.required],
            rol:       ['', Validators.required],
        });
        this.formTutor = this.fb.group({
            docenteId: ['', Validators.required],
        });
        this.cargarDatos();
    }

    cargarDatos(): void {
        this.cargando = true;
        this.solicitudService.obtenerPorId(this.solicitudId).subscribe({
            next: (s) => {
                this.solicitud = s;
                this.verificarTutoria(this.solicitudId);
            },
            error: () => { this.tutoriaCompletada = false; }
        });
        // Cargar todos los docentes para el selector
        this.docenteService.listar().subscribe({
            next: (d) => { this.todosDocentes = d; this.cargando = false; },
            error: () => { this.cargando = false; }
        });
        this.cargarJurados();
        this.cargarSugerencias();
    }

    verificarTutoria(solicitudId: number): void {
        // Paso 1: obtener el Tutor (entidad) asignado a la solicitud
        this.tutoriaService.obtenerTutorPorSolicitud(solicitudId).subscribe({
            next: (tutor) => {
                this.tutor = tutor;   // ← muestra el tutor activo en la sección izquierda
                const tutorId: number = tutor?.id;
                if (!tutorId) {
                    this.tutoriaTieneAsignacion = false;
                    this.tutoriaCompletada = false;
                    return;
                }
                // Paso 2: obtener el resumen de la tutoría con el tutorId real
                this.tutoriaService.obtenerResumen(tutorId, this.authService.getUserId()).subscribe({
                    next: (resumen) => {
                        this.tutoriaTieneAsignacion = true;
                        this.tutoriaFasesAprobadas = resumen.fasesAprobadas;
                        this.tutoriaCompletada = resumen.estadoTutoria === 'COMPLETADA';
                    },
                    error: () => {
                        // El tutor existe pero aún no hay tutoría iniciada
                        this.tutoriaTieneAsignacion = false;
                        this.tutoriaCompletada = false;
                    }
                });
            },
            error: () => {
                // No hay tutor asignado a esta solicitud
                this.tutor = null;
                this.tutoriaTieneAsignacion = false;
                this.tutoriaCompletada = false;
            }
        });
    }

    cargarJurados(): void {
        this.juradoService.listarPorSolicitud(this.solicitudId).subscribe({
            next: (j) => this.jurados = j,
            error: () => this.jurados = []
        });
    }

    cargarTutor(): void {
        this.juradoService.obtenerTutor(this.solicitudId).subscribe({
            next: (t) => this.tutor = t,
            error: () => this.tutor = null
        });
    }

    cargarSugerencias(): void {
        this.juradoService.sugerirDocentes(this.solicitudId, 8).subscribe({
            next: (d) => this.docentesSugeridos = d,
            error: () => this.docentesSugeridos = []
        });
    }

    // ── Docentes disponibles para el selector (excluye ya asignados) ────────
    get docentesDisponiblesParaJurado(): any[] {
        const asignadosIds = this.jurados.map(j => j.docente?.id);
        return this.todosDocentes.filter(d => !asignadosIds.includes(d.id));
    }

    get docentesDisponiblesParaTutor(): any[] {
        const tutorId = this.tutor?.docente?.id;
        return this.todosDocentes.filter(d => d.id !== tutorId);
    }

    get rolesDisponibles() {
        const rolesOcupados = this.jurados.map(j => j.rol);
        return this.ROLES.filter(r => !rolesOcupados.includes(r.value));
    }

    get tribunalCompleto(): boolean {
        return this.jurados.length >= 3;
    }

    getNombreDocente2(d: any): string {
        const u = d?.usuario;
        return u ? `${u.nombre} ${u.apellido}` : `Docente #${d.id}`;
    }

    // ── Asignar jurado manual ─────────────────────────────────────────────────
    asignarJurado(): void {
        if (this.formJurado.invalid) return;
        this.procesando = true;
        const { docenteId, rol } = this.formJurado.value;
        this.juradoService.asignarJurado(this.solicitudId, docenteId, rol).subscribe({
            next: () => {
                this.notification.success(`Jurado asignado como ${rol}`, '✓ Asignado');
                this.formJurado.reset();
                this.cargarJurados();
                this.cargarSugerencias();
                this.procesando = false;
            },
            error: (err) => {
                const msg = err.error?.error || 'No se pudo asignar el jurado.';
                this.notification.error(msg, 'Error');
                this.procesando = false;
            }
        });
    }

    asignarAutomaticamente(): void {
        this.procesando = true;
        this.juradoService.asignarAutomaticamente(this.solicitudId).subscribe({
            next: (j) => {
                this.jurados = j;
                this.notification.success('Jurados asignados automáticamente según disponibilidad.', '✓ Éxito');
                this.cargarSugerencias();
                this.procesando = false;
            },
            error: (err) => {
                const msg = err.error?.error || 'No se pudo asignar automáticamente.';
                this.notification.error(msg, 'Error');
                this.procesando = false;
            }
        });
    }

    eliminarJurado(juradoId: number): void {
        if (!confirm('¿Eliminar este jurado?')) return;
        this.juradoService.eliminarJurado(juradoId).subscribe({
            next: () => {
                this.notification.success('Jurado eliminado.', '');
                this.cargarJurados();
                this.cargarSugerencias();
            },
            error: () => this.notification.error('No se pudo eliminar.', 'Error')
        });
    }

    asignarTutor(): void {
        if (this.formTutor.invalid) return;
        this.procesando = true;
        this.juradoService.asignarTutor(this.solicitudId, this.formTutor.value.docenteId).subscribe({
            next: () => {
                this.notification.success('Tutor asignado correctamente.', '✓ Asignado');
                this.formTutor.reset();
                this.cargarSugerencias();
                this.verificarTutoria(this.solicitudId);
                this.procesando = false;
            },
            error: (err) => {
                const msg = err.error?.error || 'No se pudo asignar tutor.';
                this.notification.error(msg, 'Error');
                this.procesando = false;
            }
        });
    }

    seleccionarParaJurado(docenteId: number): void {
        this.formJurado.patchValue({ docenteId });
    }

    seleccionarParaTutor(docenteId: number): void {
        this.formTutor.patchValue({ docenteId });
    }

    getRolLabel(rol: string): string {
        return this.ROLES.find(r => r.value === rol)?.label || rol;
    }

    getNombreDocente(j: any): string {
        const u = j?.docente?.usuario;
        return u ? `${u.nombre} ${u.apellido}` : '—';
    }
}