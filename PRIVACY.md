# Privacy Notice

## Data Collection

The software may collect information about you and your use of the software and send it to Microsoft. Microsoft may use this information to provide services and improve our products and services. You may turn off the telemetry as described in the repository. There are also some features in the software that may enable you and Microsoft to collect data from users of your applications. If you use these features, you must comply with applicable law, including providing appropriate notices to users of your applications together with a copy of Microsoft's privacy statement. Our privacy statement is located at https://go.microsoft.com/fwlink/?LinkID=824704. You can learn more about data collection and use in the help documentation and our privacy statement. Your use of the software operates as your consent to these practices.

## Telemetry Collection

AutoGenesis collects telemetry data using Microsoft Application Insights to help us improve the quality and performance of our testing framework. The following information may be collected:

### Data Collected

- **Test Execution Metrics**: Information about test step execution, including:
  - Test step execution counts
  - Test step status (passed/failed)
  - Platform information (e.g., Android, iOS, Windows, macOS)
  - Test run source

- **Usage Information**:
  - Feature usage patterns
  - Error and exception information
  - Performance metrics

### Data NOT Collected

AutoGenesis does **NOT** collect:
- Personal identifying information (PII)
- Test case content or business logic
- Application data from tested applications
- Screenshots or screen recordings
- Credentials or authentication tokens
- File paths or local system information

## How to Disable Telemetry

You can disable telemetry collection by removing or commenting out the telemetry-related code in your test environment configuration.

### For BDD/Behave Tests

To disable telemetry in your Behave tests, modify the `environment.py` file:

**Option 1: Comment out telemetry initialization**

In `behave-demo/features/environment.py`, comment out or remove the following lines:

```python
# In before_all function (around line 136)
# telemetry_client = TelemetryClient('6cfcacca-7f4d-476e-85f4-c184d70ccff9')
# context.telemetry_client = telemetry_client
```

**Option 2: Comment out telemetry tracking**

In the `after_step` function (around line 258), comment out or remove:

```python
# context.telemetry_client.track_metric(
#     "TestStepExecuted", 1,
#     properties={
#         "Platform": "Android",
#         "Status": 'Passed' if step.status == 'passed' else 'Failed',
#         "RunSource": "OpenResource"
#     }
# )
# context.telemetry_client.flush()
```

**Option 3: Set environment variable**

You can also disable telemetry by setting an environment variable:

```bash
export DISABLE_TELEMETRY=1
```

Then modify the code to check this variable before initializing telemetry:

```python
import os

if not os.environ.get('DISABLE_TELEMETRY'):
    telemetry_client = TelemetryClient('your-key')
    context.telemetry_client = telemetry_client
```

### For Custom Implementations

If you're implementing your own test scenarios using AutoGenesis:

1. **Don't import Application Insights**: Remove or avoid importing `applicationinsights`
2. **Don't initialize TelemetryClient**: Skip telemetry client initialization
3. **Remove tracking calls**: Don't call `track_metric`, `track_event`, or similar methods

## Microsoft Privacy Statement

For more information about Microsoft's privacy practices, please see the Microsoft Privacy Statement at:
https://privacy.microsoft.com/privacystatement

## Contact

If you have questions about data collection or privacy, please contact:
- Email: fsqgroup@microsoft.com
- Privacy concerns: https://privacy.microsoft.com/

## Additional Resources

- [Microsoft Privacy Statement](https://go.microsoft.com/fwlink/?LinkID=824704)
- [Application Insights Documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Microsoft Trust Center](https://www.microsoft.com/trust-center)
