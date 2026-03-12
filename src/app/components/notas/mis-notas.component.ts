import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { AuthService } from '../../services/auth.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-mis-notas',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './mis-notas.component.html',
    styleUrls: ['./mis-notas.component.css']
})
export class MisNotasComponent implements OnInit {
    evaluaciones: any[] = [];
    cargando = true;
    estudianteId = 0;

    constructor(private evalService: EvaluacionService, private authService: AuthService) {}

    ngOnInit(): void {
        this.estudianteId = this.authService.getUserId();
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.evalService.listarPorUsuario(this.estudianteId).subscribe({
            next: (data) => { this.evaluaciones = data; this.cargando = false; },
            error: () => { this.cargando = false; }
        });
    }

    getBadge(resultado: string): string {
        return resultado === 'APROBADO' ? 'badge-aprobado' : 'badge-reprobado';
    }

    promedio(): number {
        if (!this.evaluaciones.length) return 0;
        const sum = this.evaluaciones.reduce((a, e) => a + (e.notaFinal || 0), 0);
        return Math.round((sum / this.evaluaciones.length) * 10) / 10;
    }
}