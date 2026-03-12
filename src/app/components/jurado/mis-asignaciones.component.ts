import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { JuradoService } from '../../services/jurado.service';
import { AuthService } from '../../services/auth.service';
import { DocenteService } from '../../services/docente.service';
import { EvaluacionService } from '../../services/evaluacion.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-mis-asignaciones',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './mis-asignaciones.component.html',
    styleUrls: ['./mis-asignaciones.component.css']
})
export class MisAsignacionesComponent implements OnInit {
    asignaciones: any[] = [];
    asignacionesTutor: any[] = [];
    cargando = true;
    docenteId: number | null = null;

    /**
     * Set de solicitudIds que YA tienen evaluación final registrada por el coordinador.
     * Para esas solicitudes el botón Evaluar debe estar deshabilitado.
     */
    solicitudesEvaluadas = new Set<number>();

    constructor(
        private juradoService: JuradoService,
        private docenteService: DocenteService,
        private authService: AuthService,
        private evaluacionService: EvaluacionService
    ) {}

    ngOnInit(): void {
        setTimeout(() => { if (this.cargando) this.cargando = false; }, 10000);
        const userId = this.authService.getUserId();
        this.docenteService.obtenerPorUsuario(userId).subscribe({
            next: (docente) => { this.docenteId = docente.id; this.cargarAsignaciones(docente.id); },
            error: () => { this.cargando = false; }
        });
    }

    cargarAsignaciones(docenteId: number): void {
        this.juradoService.listarPorDocente(docenteId).subscribe({
            next: (data) => {
                this.asignaciones = data;
                this.verificarEvaluacionesFinal(data.map((j: any) => j.solicitud?.id).filter(Boolean));
                this.cargando = false;
            },
            error: () => { this.cargando = false; }
        });

        this.juradoService.listarTutoriasPorDocente(docenteId).subscribe({
            next: (data) => { this.asignacionesTutor = data; },
            error: () => { this.asignacionesTutor = []; }
        });
    }

    /** Consulta en paralelo si cada solicitud ya tiene evaluación final del coordinador */
    verificarEvaluacionesFinal(solicitudIds: number[]): void {
        if (solicitudIds.length === 0) return;

        const checks = solicitudIds.map(id =>
            this.evaluacionService.porSolicitud(id).pipe(
                map(eval_ => ({ id, existe: !!eval_?.notaFinal })),
                catchError(() => of({ id, existe: false }))
            )
        );

        forkJoin(checks).subscribe(resultados => {
            resultados.forEach(r => { if (r.existe) this.solicitudesEvaluadas.add(r.id); });
        });
    }

    /** ¿Ya fue evaluada finalmente esta solicitud? */
    yaEvaluada(solicitudId: number): boolean {
        return this.solicitudesEvaluadas.has(solicitudId);
    }

    getRolLabel(rol: string): string {
        const map: Record<string, string> = {
            PRESIDENTE: 'Presidente del Tribunal', VOCAL_1: 'Vocal 1', VOCAL_2: 'Vocal 2',
        };
        return map[rol] || rol;
    }

    getRolColor(rol: string): string {
        const map: Record<string, string> = {
            PRESIDENTE: 'rol-presidente', VOCAL_1: 'rol-vocal1', VOCAL_2: 'rol-vocal2',
        };
        return map[rol] || '';
    }

    getEstadoBadge(estado: string): string {
        const map: Record<string, string> = {
            APROBADA: 'badge-aprobada', ENVIADA: 'badge-enviada', CREADA: 'badge-creada',
        };
        return map[estado] || 'badge-default';
    }

    getNombreEstudiante(j: any): string {
        const u = j?.solicitud?.estudiante?.usuario;
        return u ? `${u.nombre} ${u.apellido}` : '—';
    }

    getTitulo(j: any): string { return j?.solicitud?.tituloTema || '—'; }
}