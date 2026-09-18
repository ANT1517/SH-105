import math
from app.contracts.simulator import SimulatorInput, SimulatorResult

def run_savings_goal_simulation(input_data: SimulatorInput) -> SimulatorResult:
    """
    Deterministically simulates the savings goal feasibility.
    """
    gap = max(input_data.target - input_data.saved, 0.0)
    
    months_required = None
    feasible = None
    assumptions = []
    missing_information = []
    
    if gap == 0:
        assumptions.append("The target has already been met or exceeded.")
        # If there's no gap, it's inherently feasible today.
        feasible = True
        months_required = 0
    else:
        # Calculate months required if a contribution is provided
        if input_data.monthly_contribution is not None:
            if input_data.monthly_contribution > 0:
                months_required = math.ceil(gap / input_data.monthly_contribution)
            else:
                missing_information.append("Valid (positive) monthly contribution is required to calculate time needed.")
        else:
            missing_information.append("Monthly contribution amount is required to calculate time needed.")
            
        # Determine feasibility if timeframe is provided
        if input_data.timeframe_months is not None:
            if input_data.timeframe_months < 0:
                missing_information.append("Valid (positive) timeframe is required to check feasibility.")
            elif months_required is not None:
                feasible = months_required <= input_data.timeframe_months
            else:
                missing_information.append("Cannot determine feasibility without a valid monthly contribution.")
        else:
            missing_information.append("Timeframe (in months) is required to determine feasibility.")

    return SimulatorResult(
        scenario=input_data.scenario,
        target=input_data.target,
        saved=input_data.saved,
        gap=gap,
        monthly_contribution=input_data.monthly_contribution,
        months_required=months_required,
        feasible=feasible,
        assumptions=assumptions,
        missing_information=missing_information
    )
