import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { JuradoService } from '../../../services/jurado.service';
import { DocenteService } from '../../../services/docente.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-asignar-tribunal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './asignar-tribunal.component.html',
    styleUrls: ['./asignar-tribunal.component.css']
})
export class AsignarTribunalComponent implements OnInit {
    solicitudId!: number;
    solicitud: any = null;

    docentes: any[] = [];
    sugeridos: any[] = [];
    jurados: any[] = [];
    tutor: any = null;

    formJurado!: FormGroup;
    formTutor!: FormGroup;

    cargando = false;
    enviando = false;

    roles = ['PRESIDENTE', 'VOCAL_1', 'VOCAL_2'];

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        public router: Router,
        private juradoService: JuradoService,
        private docenteService: DocenteService,
        private solicitudService: SolicitudService,
        private notification: NotificationService
    ) {}

    ngOnInit(): void {
        this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
        this.formJurado = this.fb.group({
            docenteId: ['', Validators.required],
            rol: ['', Validators.required]
        });
        this.formTutor = this.fb.group({
            docenteId: ['', Validators.required]
        });
        this.cargarDatos();
    }

    cargarDatos(): void {
        this.cargando = true;
        this.solicitudService.obtenerPorId(this.solicitudId).subscribe(s => this.solicitud = s);
        this.docenteService.listar().subscribe(d => this.docentes = d);
        this.juradoService.sugerirDocentes(this.solicitudId, 6).subscribe({
            next: s => this.sugeridos = s,
            error: () => this.sugeridos = []
        });
        this.juradoService.listarPorSolicitud(this.solicitudId).subscribe({
            next: j => { this.jurados = j; this.cargando = false; },
            error: () => this.cargando = false
        });
        this.juradoService.obtenerTutor(this.solicitudId).subscribe({
            next: t => this.tutor = t,
            error: () => this.tutor = null
        });
    }

    asignarJurado(): void {
        if (this.formJurado.invalid) return;
        this.enviando = true;
        const { docenteId, rol } = this.formJurado.value;
        this.juradoService.asignarJurado(this.solicitudId, docenteId, rol).subscribe({
            next: () => {
                this.notification.success('Jurado asignado correctamente.', '✓ Asignado');
                this.formJurado.reset();
                this.enviando = false;
                this.cargarDatos();
            },
            error: (err) => {
                const msg = err.error?.error || 'Error al asignar jurado.';
                this.notification.error(msg, 'Error');
                this.enviando = false;
            }
        });
    }

    asignarTutor(): void {
        if (this.formTutor.invalid) return;
        this.enviando = true;
        const { docenteId } = this.formTutor.value;
        this.juradoService.asignarTutor(this.solicitudId, docenteId).subscribe({
            next: t => {
                this.tutor = t;
                this.notification.success('Tutor asignado correctamente.', '✓ Asignado');
                this.formTutor.reset();
                this.enviando = false;
            },
            error: (err) => {
                const msg = err.error?.error || 'Error al asignar tutor.';
                this.notification.error(msg, 'Error');
                this.enviando = false;
            }
        });
    }

    eliminarJurado(id: number): void {
        this.juradoService.eliminarJurado(id).subscribe({
            next: () => { this.notification.success('Jurado eliminado.', ''); this.cargarDatos(); },
            error: () => this.notification.error('No se pudo eliminar.', 'Error')
        });
    }

    eliminarTutor(): void {
        if (!this.tutor) return;
        this.juradoService.eliminarTutor(this.tutor.id).subscribe({
            next: () => { this.tutor = null; this.notification.success('Tutor eliminado.', ''); this.cargarDatos(); },
            error: () => this.notification.error('No se pudo eliminar el tutor.', 'Error')
        });
    }

    usarSugerido(docenteId: number): void {
        this.formJurado.patchValue({ docenteId });
    }

    nombreDocente(d: any): string {
        return d?.usuario ? `${d.usuario.nombre} ${d.usuario.apellido}` : '—';
    }

    rolesDisponibles(): string[] {
        const usados = this.jurados.map((j: any) => j.rol);
        return this.roles.filter(r => !usados.includes(r));
    }

    todoAsignado(): boolean {
        return this.jurados.length >= 3 && this.tutor != null;
    }
}