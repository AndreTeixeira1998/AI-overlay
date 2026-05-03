export interface ProblemStatementData {
  problem_statement: string
  input_format: {
    description: string
    parameters: any[]
  }
  output_format: {
    description: string
    type: string
    subtype: string
  }
  complexity: {
    time: string
    space: string
  }
  test_cases: any[]
  validation_type: string
  difficulty: string
}
