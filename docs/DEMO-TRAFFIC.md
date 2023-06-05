# Demo Site Traffic

The Demo site traffic consists of simulated data and some real data that comes from the page itself.

At some point the simulated data was generating 100 records every 1 minute 24x7 over three sites. This was to test how Firehose, S3 and
Athena would handle the load. The firehose buffering was also at 1 minute, this was to force the setup to generate S3
files every minute.

Since this is a schema on read system, I was particularly interested in seeing the costs associated
with Athena scanning/doing S3 GET requests and weather it can still produce results in a timely manner. The results were
very good, the system was able to handle the load and produce results in a timely manner.

But the simulated traffic had to be changed to accommodate the high view rate of the dashboard. The simulated traffic
was changed instead of optimizing the Athena & S3 section of the system because this problem is only inherit to the
demo site. Ideally you will not have 10k+ users viewing the dashboard all the time. It would be a select few users
throughout the day.

The simulated traffic was changed to a burst of 10k records every 1 hour. This reduces the amount of buckets Firehose
creates and also the amount of files written to S3. This in return reduces the amount of S3 GET requests made by Athena
when querying the data.

**The system is designed for around 1 to 10 million page views. There is a high traffic demo site available that is
guarded by authentication. Contact me if you wish to have a look at how this solution performs at scale.**
