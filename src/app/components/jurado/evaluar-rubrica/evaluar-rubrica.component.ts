import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RubricaEvaluacionService, CriterioRubrica, EvaluacionRubricaResponse } from '../../../services/rubrica-evaluacion.service';
import { JuradoService } from '../../../services/jurado.service';
import { AuthService } from '../../../services/auth.service';
import { DocenteService } from '../../../services/docente.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { NotificationService } from '../../../services/notification.service';

interface CriterioUI extends CriterioRubrica {
    escalaSeleccionada: number | null;
    observaciones: string;
}

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-evaluar-rubrica',
    standalone: true,
    imports: [CommonModule, DecimalPipe, FormsModule, RouterModule],
    templateUrl: './evaluar-rubrica.component.html',
    styleUrls: ['./evaluar-rubrica.component.css']
})
export class EvaluarRubricaComponent implements OnInit {

    solicitudId!: number;
    solicitud: any = null;
    juradoInfo: any = null;
    docenteId: number | null = null;
    rubrica: any = null;

    criteriosUI: CriterioUI[] = [];
    evaluacionPrevia: EvaluacionRubricaResponse | null = null;
    evaluacionesTribunal: EvaluacionRubricaResponse[] = [];

    observacionesGenerales = '';
    cargando = true;
    enviando = false;

    /** Escalas según rúbrica institucional UTEQ */
    readonly ESCALAS = [
        { valor: 100, etiqueta: 'Completo',                    color: 'escala-100' },
        { valor: 67,  etiqueta: 'Casi completo',               color: 'escala-67'  },
        { valor: 33,  etiqueta: 'Significativamente incompleto', color: 'escala-33' },
        { valor: 0,   etiqueta: 'No presenta/entrega',         color: 'escala-0'   },
    ];

    constructor(
        private route: ActivatedRoute,
        private rubricaEvalService: RubricaEvaluacionService,
        private juradoService: JuradoService,
        private docenteService: DocenteService,
        private authService: AuthService,
        private solicitudService: SolicitudService,
        private notification: NotificationService
    ) {}

    ngOnInit(): void {
        setTimeout(() => { if (this.cargando) this.cargando = false; }, 10000);
        this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
        const userId = this.authService.getUserId();

        this.docenteService.obtenerPorUsuario(userId).subscribe({
            next: (docente) => {
                this.docenteId = docente.id;
                this.cargarDatos();
            },
            error: () => {
                this.cargando = false;
                this.notification.error('No se encontró tu perfil de docente.', 'Error');
            }
        });
    }

    cargarDatos(): void {
        this.solicitudService.obtenerPorId(this.solicitudId).subscribe(s => this.solicitud = s);

        this.juradoService.listarPorSolicitud(this.solicitudId).subscribe({
            next: (jurados) => {
                this.juradoInfo = jurados.find((j: any) => j.docente?.id === this.docenteId) || null;

                if (!this.juradoInfo) {
                    this.cargando = false;
                    return;
                }

                this.rubricaEvalService.listarRubricas().subscribe({
                    next: (rubricas) => {
                        if (rubricas.length === 0) {
                            this.cargando = false;
                            this.notification.error('No hay rúbricas configuradas.', 'Error');
                            return;
                        }
                        this.rubrica = rubricas[0];
                        this.cargarCriterios(this.rubrica.id);
                    }
                });
            }
        });

        this.rubricaEvalService.obtenerEvaluacionesSolicitud(this.solicitudId).subscribe({
            next: (evals) => this.evaluacionesTribunal = evals,
            error: () => {}
        });
    }

    cargarCriterios(rubricaId: number): void {
        this.rubricaEvalService.criteriosPorRubrica(rubricaId).subscribe({
            next: (criterios) => {
                if (criterios.length === 0) {
                    this.rubricaEvalService.inicializarCriterios(rubricaId).subscribe({
                        next: (resp) => {
                            const lista: CriterioRubrica[] = resp.criterios || resp;
                            this.criteriosUI = lista.map((c: CriterioRubrica) => ({
                                ...c, escalaSeleccionada: null, observaciones: ''
                            }));
                            this.cargarEvaluacionPrevia();
                        },
                        error: () => { this.cargando = false; }
                    });
                } else {
                    this.criteriosUI = criterios.map(c => ({
                        ...c, escalaSeleccionada: null, observaciones: ''
                    }));
                    this.cargarEvaluacionPrevia();
                }
            }
        });
    }

    cargarEvaluacionPrevia(): void {
        if (!this.juradoInfo) { this.cargando = false; return; }

        this.rubricaEvalService.obtenerEvaluacionJurado(this.solicitudId, this.juradoInfo.id).subscribe({
            next: (eval_) => {
                this.evaluacionPrevia = eval_;
                if (eval_.detalles?.length > 0) {
                    this.criteriosUI.forEach(cu => {
                        const detalle = eval_.detalles.find(d => d.criterioId === cu.id);
                        if (detalle) {
                            cu.escalaSeleccionada = detalle.escala;
                            cu.observaciones = detalle.observaciones || '';
                        }
                    });
                }
                this.cargando = false;
            },
            error: () => { this.cargando = false; }
        });
    }

    seleccionarEscala(criterio: CriterioUI, escala: number): void {
        criterio.escalaSeleccionada = criterio.escalaSeleccionada === escala ? null : escala;
    }

    get todosCriteriosEvaluados(): boolean {
        return this.criteriosUI.length > 0 &&
            this.criteriosUI.every(c => c.escalaSeleccionada !== null);
    }

    get notaParcialPreview(): number {
        return this.criteriosUI.reduce((acc, c) => {
            if (c.escalaSeleccionada === null) return acc;
            return acc + (c.ponderacion * c.escalaSeleccionada / 100);
        }, 0);
    }

    get resultadoPreview(): 'APROBADO' | 'REPROBADO' | '—' {
        if (!this.todosCriteriosEvaluados) return '—';
        return this.notaParcialPreview >= 7 ? 'APROBADO' : 'REPROBADO';
    }

    notaCriterio(criterio: CriterioUI): number | null {
        if (criterio.escalaSeleccionada === null) return null;
        return Math.round(criterio.ponderacion * criterio.escalaSeleccionada / 100 * 100) / 100;
    }

    guardar(): void {
        if (!this.todosCriteriosEvaluados || !this.juradoInfo || !this.rubrica) return;
        this.enviando = true;

        const request = {
            solicitudId: this.solicitudId,
            juradoId: this.juradoInfo.id,
            rubricaId: this.rubrica.id,
            criterios: this.criteriosUI.map(c => ({
                criterioId: c.id,
                escala: c.escalaSeleccionada!,
                observaciones: c.observaciones
            })),
            observaciones: this.observacionesGenerales
        };

        this.rubricaEvalService.registrar(request).subscribe({
            next: (resp) => {
                this.evaluacionPrevia = resp;
                this.notification.success(
                    `Evaluación registrada. Tu nota: ${resp.notaTotalJurado?.toFixed(2) ?? '—'} / 10`,
                    '✓ Guardado'
                );
                this.enviando = false;
                this.rubricaEvalService.obtenerEvaluacionesSolicitud(this.solicitudId).subscribe({
                    next: (evals) => this.evaluacionesTribunal = evals
                });
            },
            error: (err) => {
                const msg = err.error?.error || 'Error al guardar la evaluación.';
                this.notification.error(msg, 'Error');
                this.enviando = false;
            }
        });
    }

    editarEvaluacion(): void {
        this.evaluacionPrevia = null;
    }

    getLabelEscala(escala: number): string {
        return this.ESCALAS.find(e => e.valor === escala)?.etiqueta || String(escala);
    }
}