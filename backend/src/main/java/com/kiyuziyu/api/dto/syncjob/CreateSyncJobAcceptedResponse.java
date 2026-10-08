package com.kiyuziyu.api.dto.syncjob;

public class CreateSyncJobAcceptedResponse {

    private String jobId;
    private String status;
    private String jobType;

    public CreateSyncJobAcceptedResponse() {
    }

    public CreateSyncJobAcceptedResponse(String jobId, String status, String jobType) {
        this.jobId = jobId;
        this.status = status;
        this.jobType = jobType;
    }

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getJobType() {
        return jobType;
    }

    public void setJobType(String jobType) {
        this.jobType = jobType;
    }
}
