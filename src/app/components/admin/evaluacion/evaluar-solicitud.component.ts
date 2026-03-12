import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EvaluacionService } from '../../../services/evaluacion.service';
import { RubricaService } from '../../../services/rubrica.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { JuradoService } from '../../../services/jurado.service';
import { ActaService } from '../../../services/acta.service';
import { RubricaEvaluacionService, EvaluacionRubricaResponse } from '../../../services/rubrica-evaluacion.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-evaluar-solicitud',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './evaluar-solicitud.component.html',
  styleUrls: ['./evaluar-solicitud.component.css']
})
export class EvaluarSolicitudComponent implements OnInit {
  form!: FormGroup;
  rubricas: any[] = [];
  solicitud: any = null;
  solicitudId!: number;
  jurados: any[] = [];
  tutor: any = null;
  enviando = false;
  evaluacionExistente: any = null;
  acta: any = null;
  firmandoActa = false;
  modalObs: string | null = null;
  modalTitulo = '';

  // ★ NEW: evaluaciones del tribunal por rúbrica
  evaluacionesTribunal: EvaluacionRubricaResponse[] = [];
  notaTribunalRubrica: number | null = null;
  tribunalCompleto = false;

  readonly ROLES_FIRMA = [
    { value: 'PRESIDENTE', label: 'Presidente' },
    { value: 'VOCAL_1',    label: 'Vocal 1' },
    { value: 'VOCAL_2',    label: 'Vocal 2' },
    { value: 'TUTOR',      label: 'Tutor' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private evalService: EvaluacionService,
    private rubricaService: RubricaService,
    private solicitudService: SolicitudService,
    private juradoService: JuradoService,
    private actaService: ActaService,
    private rubricaEvalService: RubricaEvaluacionService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    // Coordinator only enters notaInstructor (60%); notaJurado comes from rubric evaluations
    this.form = this.fb.group({
      rubricaId:      ['', Validators.required],
      notaInstructor: ['', [Validators.required, Validators.min(0), Validators.max(10)]],
      observaciones:  ['', Validators.required]
    });
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.rubricaService.listar().subscribe(r => this.rubricas = r);
    this.solicitudService.obtenerPorId(this.solicitudId).subscribe(s => this.solicitud = s);
    this.juradoService.listarPorSolicitud(this.solicitudId).subscribe({ next: j => this.jurados = j, error: () => {} });
    this.juradoService.obtenerTutor(this.solicitudId).subscribe({ next: t => this.tutor = t, error: () => {} });
    this.evalService.porSolicitud(this.solicitudId).subscribe({ next: e => this.evaluacionExistente = e, error: () => {} });
    this.actaService.porSolicitud(this.solicitudId).subscribe({ next: a => this.acta = a, error: () => {} });

    // ★ Load tribunal rubric evaluations
    this.cargarNotaTribunal();
  }

  cargarNotaTribunal(): void {
    this.rubricaEvalService.obtenerEvaluacionesSolicitud(this.solicitudId).subscribe({
      next: (evals) => {
        this.evaluacionesTribunal = evals;
        if (evals.length > 0) {
          this.notaTribunalRubrica = evals[0].notaPromedioTribunal;
          this.tribunalCompleto = evals[0].tribunalCompleto;
        }
      },
      error: () => {}
    });
  }

  // ── Cálculo en tiempo real ────────────────────────────────────────────────
  get notaInstructor(): number { return +this.form.get('notaInstructor')?.value || 0; }
  get notaJurado(): number     { return this.notaTribunalRubrica ?? 0; }

  get notaFinalPreview(): number {
    return Math.round(((this.notaInstructor * 60 / 100)
                     + (this.notaJurado * 40 / 100)) * 100) / 100;
  }

  get resultadoPreview(): string {
    if (!this.form.get('notaInstructor')?.value) return '—';
    return this.notaFinalPreview >= 7 ? 'APROBADO' : 'REPROBADO';
  }

  // ── Guardar evaluación ───────────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) return;

    if (!this.tribunalCompleto) {
      this.notification.error(
        'El tribunal aún no ha completado su evaluación por rúbrica. Todos los jurados deben evaluar antes.',
        'Tribunal incompleto'
      );
      return;
    }

    this.enviando = true;
    const { rubricaId, notaInstructor, observaciones } = this.form.value;
    const notaJurado = this.notaTribunalRubrica!;

    this.evalService.evaluarPonderado(
      this.solicitudId, rubricaId,
      notaInstructor, notaJurado,
      observaciones, 60, 40
    ).subscribe({
      next: (e) => {
        this.evaluacionExistente = e;
        this.notification.success(
          `Evaluación registrada. Nota final: ${e.notaFinal?.toFixed(2)} — ${e.resultado}`,
          '✓ Evaluado'
        );
        this.enviando = false;
        this.generarActaAutomatica();
      },
      error: (err) => {
        const msg = err.error?.error || 'No se pudo registrar la evaluación.';
        this.notification.error(msg, 'Error');
        this.enviando = false;
      }
    });
  }

  generarActaAutomatica(): void {
    this.actaService.generarActa(this.solicitudId).subscribe({
      next: (a) => {
        this.acta = a;
        this.notification.success('Acta generada automáticamente.', '📄 Acta lista');
      },
      error: () => {}
    });
  }

  firmarActa(rol: string): void {
    if (!this.acta) return;
    this.firmandoActa = true;
    this.actaService.firmarActa(this.acta.id, rol).subscribe({
      next: (a) => {
        this.acta = a;
        const msg = a.firmada ? '¡Acta completamente firmada por todos los actores!' : `Firma de ${rol} registrada.`;
        this.notification.success(msg, '✍️ Firmado');
        this.firmandoActa = false;
      },
      error: (err) => {
        const msg = err.error?.error || 'No se pudo registrar la firma.';
        this.notification.error(msg, 'Error');
        this.firmandoActa = false;
      }
    });
  }

  descargarActa(): void {
    if (!this.acta) return;
    this.actaService.descargarPdf(this.acta.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `acta_solicitud_${this.solicitudId}.pdf`; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.notification.error('No se pudo descargar el PDF.', 'Error')
    });
  }

  firmaEstado(rol: string): boolean {
    if (!this.acta) return false;
    const map: Record<string, boolean> = {
      PRESIDENTE: this.acta.firmadaPresidente,
      VOCAL_1:    this.acta.firmadaVocal1,
      VOCAL_2:    this.acta.firmadaVocal2,
      TUTOR:      this.acta.firmadaTutor,
    };
    return map[rol] ?? false;
  }

  getNombreJuradoPorRol(rol: string): string {
    const j = this.jurados.find(x => x.rol === rol);
    const u = j?.docente?.usuario;
    return u ? `${u.nombre} ${u.apellido}` : '—';
  }

  verObservaciones(titulo: string, obs: string): void {
    this.modalTitulo = titulo;
    this.modalObs = obs;
  }
  cerrarModal(): void { this.modalObs = null; }
}