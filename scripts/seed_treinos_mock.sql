-- Popular treinos_plano e treinos_realizados com os mesmos dados mockados de src/pages/Treino.jsx
-- Pré-requisito: pelo menos 1 linha em public.usuarios
-- Execute no SQL Editor do Supabase.

-- 1) Planos (3 treinos)
INSERT INTO public.treinos_plano (usuario_id, nome, personal_id, data_prevista, categoria, exercicios)
SELECT id, 'Peito + Triceps', NULL, CURRENT_DATE, 'chest', '[
  {"id": 1, "nome": "Supino reto", "series": 4, "repeticoes": 10, "carga": 80, "met": 5.0, "video_url": null},
  {"id": 2, "nome": "Crucifixo inclinado", "series": 3, "repeticoes": 12, "carga": 20, "met": 4.5, "video_url": null},
  {"id": 3, "nome": "Triceps corda", "series": 3, "repeticoes": 15, "carga": 35, "met": 4.0, "video_url": null},
  {"id": 4, "nome": "Mergulho no banco", "series": 3, "repeticoes": 0, "carga": 0, "met": 4.0, "video_url": null}
]'::jsonb
FROM public.usuarios
ORDER BY id
LIMIT 1;

INSERT INTO public.treinos_plano (usuario_id, nome, personal_id, data_prevista, categoria, exercicios)
SELECT id, 'Costas + Biceps', NULL, CURRENT_DATE + 1, 'upper', '[
  {"id": 5, "nome": "Puxada alta", "series": 4, "repeticoes": 12, "carga": 55, "met": 4.7, "video_url": null},
  {"id": 6, "nome": "Remada curvada", "series": 4, "repeticoes": 10, "carga": 60, "met": 5.2, "video_url": null},
  {"id": 7, "nome": "Rosca direta", "series": 3, "repeticoes": 12, "carga": 25, "met": 4.1, "video_url": null}
]'::jsonb
FROM public.usuarios
ORDER BY id
LIMIT 1;

INSERT INTO public.treinos_plano (usuario_id, nome, personal_id, data_prevista, categoria, exercicios)
SELECT id, 'Pernas', NULL, CURRENT_DATE + 2, 'legs', '[
  {"id": 8, "nome": "Agachamento livre", "series": 4, "repeticoes": 8, "carga": 90, "met": 6.0, "video_url": null},
  {"id": 9, "nome": "Leg press", "series": 4, "repeticoes": 12, "carga": 180, "met": 5.6, "video_url": null},
  {"id": 10, "nome": "Extensora", "series": 3, "repeticoes": 15, "carga": 40, "met": 4.2, "video_url": null},
  {"id": 11, "nome": "Panturrilha em pe", "series": 4, "repeticoes": 20, "carga": 50, "met": 3.8, "video_url": null}
]'::jsonb
FROM public.usuarios
ORDER BY id
LIMIT 1;

-- 2) Exemplos de treinos realizados (formato próximo ao webhook do README)
INSERT INTO public.treinos_realizados (usuario_id, plano_id, nome, data_hora, exercicios, duracao_min, kcal_gastas, concluido)
SELECT u.id, p.id, p.nome, now() - interval '2 days', '[
  {"nome": "Supino reto", "series_feitas": 4, "met": 5.0, "duracao_min": 12},
  {"nome": "Crucifixo inclinado", "series_feitas": 3, "met": 4.5, "duracao_min": 10},
  {"nome": "Triceps corda", "series_feitas": 3, "met": 4.0, "duracao_min": 8},
  {"nome": "Mergulho no banco", "series_feitas": 3, "met": 4.0, "duracao_min": 9}
]'::jsonb, 48, 220, true
FROM public.usuarios u
JOIN public.treinos_plano p ON p.usuario_id = u.id AND p.nome = 'Peito + Triceps'
ORDER BY u.id, p.created_at DESC
LIMIT 1;

INSERT INTO public.treinos_realizados (usuario_id, plano_id, nome, data_hora, exercicios, duracao_min, kcal_gastas, concluido)
SELECT u.id, p.id, p.nome, now() - interval '5 days', '[
  {"nome": "Puxada alta", "series_feitas": 4, "met": 4.7, "duracao_min": 14},
  {"nome": "Remada curvada", "series_feitas": 4, "met": 5.2, "duracao_min": 16},
  {"nome": "Rosca direta", "series_feitas": 3, "met": 4.1, "duracao_min": 10}
]'::jsonb, 52, 195, true
FROM public.usuarios u
JOIN public.treinos_plano p ON p.usuario_id = u.id AND p.nome = 'Costas + Biceps'
ORDER BY u.id, p.created_at DESC
LIMIT 1;
