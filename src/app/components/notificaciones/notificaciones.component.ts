import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificacionService } from '../../services/notificacion.service';
import { AuthService } from '../../services/auth.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-notificaciones',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notificaciones.component.html',
    styleUrls: ['./notificaciones.component.css']
})
export class NotificacionesComponent implements OnInit {
    notificaciones: any[] = [];
    cargando = false;
    usuarioId = 0;

    constructor(private notiService: NotificacionService, private authService: AuthService) {}

    ngOnInit(): void {
        this.usuarioId = this.authService.getUserId();
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.notiService.listarPorUsuario(this.usuarioId).subscribe({
            next: (data) => {
                this.notificaciones = data;
                this.cargando = false;
                // Refrescar badge real desde el servidor
                this.notiService.refrescarBadge(this.usuarioId);
            },
            error: () => { this.cargando = false; }
        });
    }

    marcarLeida(id: number): void {
        const n = this.notificaciones.find(x => x.id === id);
        if (n && n.leida) return;
        this.notiService.marcarLeida(id).subscribe({
            next: () => { if (n) n.leida = true; }
        });
    }

    marcarTodas(): void {
        this.notiService.marcarTodasLeidas(this.usuarioId).subscribe({
            next: () => this.notificaciones.forEach(n => n.leida = true)
        });
    }

    get noLeidas(): number {
        return this.notificaciones.filter(n => !n.leida).length;
    }
}