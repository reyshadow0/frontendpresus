import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EscalaCriterioDTO {
  criterioId: number;
  escala: number;   // 100 | 67 | 33 | 0
  observaciones?: string;
}

export interface EvaluacionRubricaRequest {
  solicitudId: number;
  juradoId: number;
  rubricaId: number;
  criterios: EscalaCriterioDTO[];
  observaciones?: string;
}

export interface CriterioResultado {
  criterioId: number;
  nombreCriterio: string;
  ponderacion: number;
  escala: number;
  notaObtenida: number;
  observaciones?: string;
}

export interface EvaluacionRubricaResponse {
  solicitudId: number;
  juradoId: number;
  nombreJurado: string;
  rolJurado: string;
  detalles: CriterioResultado[];
  notaTotalJurado: number | null;
  notaPromedioTribunal: number | null;
  tribunalCompleto: boolean;
}

export interface CriterioRubrica {
  id: number;
  nombre: string;
  descripcion: string;
  ponderacion: number;
  orden: number;
}

@Injectable({ providedIn: 'root' })
export class RubricaEvaluacionService {
  private api = 'http://localhost:8080/api/rubrica-evaluacion';
  private rubricaApi = 'http://localhost:8080/api/rubricas';

  constructor(private http: HttpClient) {}

  registrar(request: EvaluacionRubricaRequest): Observable<EvaluacionRubricaResponse> {
    return this.http.post<EvaluacionRubricaResponse>(`${this.api}/registrar`, request);
  }

  obtenerEvaluacionJurado(solicitudId: number, juradoId: number): Observable<EvaluacionRubricaResponse> {
    return this.http.get<EvaluacionRubricaResponse>(`${this.api}/solicitud/${solicitudId}/jurado/${juradoId}`);
  }

  obtenerEvaluacionesSolicitud(solicitudId: number): Observable<EvaluacionRubricaResponse[]> {
    return this.http.get<EvaluacionRubricaResponse[]>(`${this.api}/solicitud/${solicitudId}`);
  }

  notaTribunal(solicitudId: number): Observable<{ nota: number | null; mensaje?: string }> {
    return this.http.get<any>(`${this.api}/nota-tribunal/${solicitudId}`);
  }

  criteriosPorRubrica(rubricaId: number): Observable<CriterioRubrica[]> {
    return this.http.get<CriterioRubrica[]>(`${this.api}/criterios/${rubricaId}`);
  }

  listarRubricas(): Observable<any[]> {
    return this.http.get<any[]>(this.rubricaApi);
  }

  inicializarCriterios(rubricaId: number): Observable<any> {
    return this.http.post(`${this.rubricaApi}/${rubricaId}/inicializar-criterios`, {});
  }
}
