import { describe, it, expect } from 'vitest'
import {
  translit, makeLogin, makePassword, PASSWORD_ALPHABET, slugify, unique,
} from '../src/lib/credentials.js'

describe('translit / makeLogin (ТЗ §2.1: транслит имени, суффикс при коллизии)', () => {
  it('транслитерирует русское имя', () => {
    expect(translit('артём')).toBe('artem')
    expect(translit('юля')).toBe('yulya')
  })
  it('логин — первое слово имени', () => {
    expect(makeLogin('Артём Иванов', new Set())).toBe('artem')
    expect(makeLogin('John Doe', new Set())).toBe('john')
  })
  it('коллизии получают суффиксы 2, 3, …', () => {
    expect(makeLogin('Артём', new Set(['artem']))).toBe('artem2')
    expect(makeLogin('Артём', new Set(['artem', 'artem2']))).toBe('artem3')
  })
  it('пустой транслит → user', () => {
    expect(makeLogin('!!!', new Set())).toBe('user')
  })
})

describe('makePassword (ТЗ §2.1: 8 знаков, без 0/O, 1/l/I)', () => {
  it('алфавит не содержит похожих символов', () => {
    expect(/[0O1lI]/.test(PASSWORD_ALPHABET)).toBe(false)
  })
  it('8 символов из алфавита', () => {
    const pw = makePassword()
    expect(pw).toHaveLength(8)
    for (const ch of pw) expect(PASSWORD_ALPHABET).toContain(ch)
  })
  it('детерминирован при подмене rand', () => {
    expect(makePassword(() => 0)).toBe(PASSWORD_ALPHABET[0].repeat(8))
  })
})

describe('slugify / unique (коды подходов)', () => {
  it('строит код из названия', () => {
    expect(slugify('Генерация тестов')).toBe('generatsiya-testov')
  })
  it('unique добавляет суффикс', () => {
    expect(unique('x', new Set(['x']))).toBe('x2')
  })
})
